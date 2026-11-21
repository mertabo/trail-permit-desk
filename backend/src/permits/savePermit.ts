import type { Channel } from '../data/channels';
import { isInBookingWindow, isValidDate } from '../dates';
import { pool } from '../db';
import { AppError } from '../errors';
import { logger } from '../logger';
import { validateFields } from './validateFields';

const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNIQUE_VIOLATION = '23505';

type SaveRequest = { idempotency_key: string; trail: string; date: string; channel: string; fields: unknown };

const fail = (detail: string): never => {
  throw new AppError('VALIDATION_ERROR', detail);
};

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

async function findPermitByKey(key: string) {
  const { rows } = await pool.query('SELECT * FROM permits WHERE idempotency_key = $1', [key]);
  return rows[0];
}

/**
 * Saves a permit, or throws an AppError explaining why it can't be saved.
 * Saving the same request (same idempotency key) twice returns the original permit
 * and never creates a second one.
 */
export async function savePermit(body: unknown) {
  // 1. Check the key format.
  const key = parseIdempotencyKey(body);

  // 2. If this request was already saved, return that permit. This runs before the other checks,
  //    so a replay still succeeds after midnight or after the trail closes. Any new data is ignored.
  const existing = await findPermitByKey(key);
  if (existing) {
    logger.info('Idempotent replay: returning the existing permit', { idempotency_key: key });
    return existing;
  }

  // 3. Validate the rest of the request.
  const request = parseRequest(body);
  const { rows: channels } = await pool.query<Channel>('SELECT * FROM channels WHERE id = $1', [request.channel]);
  if (channels.length === 0) fail(`unknown channel ${request.channel}`);
  const { email, party_size, details } = validateFields(channels[0], request.fields);

  // 4. Book, in one transaction on one client. Locking the trail row makes bookings for the same
  //    trail run one at a time, so two requests can never both take the last spots.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

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
    await client.query('ROLLBACK');
    const pgError = error as { code?: string; constraint?: string };
    if (pgError.code === UNIQUE_VIOLATION && pgError.constraint === 'permits_one_active_per_person') {
      throw new AppError('DUPLICATE_BOOKING');
    }
    // The same request was running twice at once and the other one saved first.
    if (pgError.code === UNIQUE_VIOLATION && pgError.constraint === 'permits_idempotency_key_key') {
      logger.info('Idempotent replay: the same request was saved concurrently', { idempotency_key: key });
      return findPermitByKey(key);
    }
    throw error;
  } finally {
    client.release();
  }
}
