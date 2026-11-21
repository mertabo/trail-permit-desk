import type { PoolClient } from 'pg';
import type { Channel } from '../data/channels';
import { isInBookingWindow, isValidDate } from '../dates';
import { pool } from '../db';
import { AppError } from '../errors';
import { logger } from '../logger';
import { validateFields } from './validateFields';

const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNIQUE_VIOLATION = '23505';

/** 1 attempt + 3 retries, waiting longer before each retry. */
export const RETRY_DELAYS_MS = [100, 200, 400];

export type DbClient = Pick<PoolClient, 'query'> & { release(error?: Error): void };
export type Db = { connect(): Promise<DbClient> };
export type SaveDependencies = { db: Db; sleep: (ms: number) => Promise<void> };

const defaultDependencies: SaveDependencies = {
  db: pool,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

type SaveRequest = { idempotency_key: string; trail: string; date: string; channel: string; fields: unknown };

const fail = (detail: string): never => {
  throw new AppError('VALIDATION_ERROR', detail);
};

/**
 * Errors worth retrying: they come from the connection or from Postgres resolving a conflict,
 * not from the request itself. A retry has a real chance of succeeding.
 */
export function isTemporaryDatabaseError(error: unknown): boolean {
  if (error instanceof AppError) return false;
  const { code, message } = (error ?? {}) as { code?: string; message?: string };
  if (code === '40P01' || code === '40001') return true; // deadlock, serialization failure
  if (code === '57P01' || code?.startsWith('08')) return true; // server shut down, connection failure
  if (code === 'ECONNRESET' || code === 'ECONNREFUSED' || code === 'EPIPE') return true;
  return /connection terminated/i.test(message ?? '');
}

/** Step 1: the idempotency key must be a UUID. */
function parseIdempotencyKey(body: unknown): string {
  const key = (body as Record<string, unknown> | null)?.idempotency_key;
  if (typeof key !== 'string' || !UUID_FORMAT.test(key)) fail('idempotency_key must be a UUID');
  return key as string;
}

/** Step 3: checks the rest of the request body. */
function parseRequest(body: unknown): SaveRequest {
  const request = body as Record<string, unknown>;
  if (!isValidDate(request.date) || !isInBookingWindow(request.date as string)) {
    fail('date must be a YYYY-MM-DD date from today to today + 30');
  }
  if (typeof request.trail !== 'string') fail('trail is required');
  if (typeof request.channel !== 'string') fail('channel is required');
  return request as SaveRequest;
}

async function findPermitByKey(client: DbClient, key: string) {
  const { rows } = await client.query('SELECT * FROM permits WHERE idempotency_key = $1', [key]);
  return rows[0];
}

/**
 * Saves a permit, or throws an AppError explaining why it can't be saved.
 * - Saving the same request (same idempotency key) twice returns the original permit.
 * - Temporary database errors are retried (1 attempt + 3 retries). Thanks to the key lookup,
 *   a retry after a commit that actually went through returns that permit instead of a duplicate.
 */
export async function savePermit(body: unknown, deps: SaveDependencies = defaultDependencies) {
  // 1. Check the key format. Not retried: a bad key stays bad.
  const key = parseIdempotencyKey(body);

  for (let attempt = 1; ; attempt++) {
    try {
      return await attemptSave(body, key, deps.db);
    } catch (error) {
      const delay = RETRY_DELAYS_MS[attempt - 1];
      if (!isTemporaryDatabaseError(error) || delay === undefined) throw error;
      logger.info('Temporary database error while saving a permit, retrying', {
        attempt,
        retryInMs: delay,
        error: String(error),
      });
      await deps.sleep(delay);
    }
  }
}

/** Steps 2–4, on one fresh connection. */
async function attemptSave(body: unknown, key: string, db: Db) {
  const client = await db.connect();
  let brokenConnection: Error | undefined;
  try {
    // 2. If this request was already saved, return that permit. This runs before the other checks,
    //    so a replay still succeeds after midnight or after the trail closes. Any new data is ignored.
    const existing = await findPermitByKey(client, key);
    if (existing) {
      logger.info('Idempotent replay: returning the existing permit', { idempotency_key: key });
      return existing;
    }

    // 3. Validate the rest of the request.
    const request = parseRequest(body);
    const { rows: channels } = await client.query<Channel>('SELECT * FROM channels WHERE id = $1', [request.channel]);
    if (channels.length === 0) fail(`unknown channel ${request.channel}`);
    const validated = validateFields(channels[0], request.fields);

    // 4. Book.
    return await book(client, key, request, validated);
  } catch (error) {
    // Hand a broken connection back with the error, so the pool discards it instead of reusing it.
    if (isTemporaryDatabaseError(error)) brokenConnection = error as Error;
    throw error;
  } finally {
    client.release(brokenConnection);
  }
}

/**
 * One transaction. Locking the trail row makes bookings for the same trail run one at a time,
 * so two requests can never both take the last spots.
 */
async function book(
  client: DbClient,
  key: string,
  request: SaveRequest,
  { email, party_size, details }: ReturnType<typeof validateFields>,
) {
  await client.query('BEGIN');
  try {
    const { rows: trails } = await client.query<{ status: string; daily_quota: number }>(
      'SELECT status, daily_quota FROM trails WHERE code = $1 FOR UPDATE',
      [request.trail],
    );
    const trail = trails[0];
    if (!trail) fail(`unknown trail ${request.trail}`);
    if (trail.status === 'closed') throw new AppError('TRAIL_CLOSED');

    const { rows } = await client.query<{ booked: number }>(
      `SELECT COALESCE(SUM(party_size), 0)::int AS booked
       FROM permits WHERE trail = $1 AND date = $2 AND status = 'active'`,
      [request.trail, request.date],
    );
    if (rows[0].booked + party_size > trail.daily_quota) throw new AppError('TRAIL_FULL');

    const { rows: inserted } = await client.query(
      `INSERT INTO permits (idempotency_key, trail, date, party_size, status, channel, email, details)
       VALUES ($1, $2, $3, $4, 'active', $5, $6, $7)
       RETURNING *`,
      [key, request.trail, request.date, party_size, request.channel, email, details],
    );

    await client.query('COMMIT');
    return inserted[0];
  } catch (error) {
    // On a broken connection ROLLBACK fails too. Ignore that, the original error is what matters.
    await client.query('ROLLBACK').catch(() => {});
    const pgError = error as { code?: string; constraint?: string };
    if (pgError.code === UNIQUE_VIOLATION && pgError.constraint === 'permits_one_active_per_person') {
      throw new AppError('DUPLICATE_BOOKING');
    }
    // The same request was running twice at once and the other one saved first.
    if (pgError.code === UNIQUE_VIOLATION && pgError.constraint === 'permits_idempotency_key_key') {
      logger.info('Idempotent replay: the same request was saved concurrently', { idempotency_key: key });
      return findPermitByKey(client, key);
    }
    throw error;
  }
}
