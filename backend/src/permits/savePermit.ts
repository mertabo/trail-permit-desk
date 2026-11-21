import type { Channel } from '../data/channels';
import { isInBookingWindow, isValidDate } from '../dates';
import { pool } from '../db';
import { AppError } from '../errors';
import { validateFields } from './validateFields';

const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNIQUE_VIOLATION = '23505';

type SaveRequest = { idempotency_key: string; trail: string; date: string; channel: string; fields: unknown };

/** Checks the shape of the request body. Throws VALIDATION_ERROR if anything is off. */
function parseRequest(body: unknown): SaveRequest {
  const request = (body ?? {}) as Record<string, unknown>;
  const fail = (detail: string) => {
    throw new AppError('VALIDATION_ERROR', detail);
  };

  if (typeof request.idempotency_key !== 'string' || !UUID_FORMAT.test(request.idempotency_key)) {
    fail('idempotency_key must be a UUID');
  }
  if (!isValidDate(request.date) || !isInBookingWindow(request.date as string)) {
    fail('date must be a YYYY-MM-DD date from today to today + 30');
  }
  if (typeof request.trail !== 'string') fail('trail is required');
  if (typeof request.channel !== 'string') fail('channel is required');
  return request as SaveRequest;
}

/** Saves a permit, or throws an AppError explaining why it can't be saved. */
export async function savePermit(body: unknown) {
  const request = parseRequest(body);

  const { rows: channels } = await pool.query<Channel>('SELECT * FROM channels WHERE id = $1', [request.channel]);
  if (channels.length === 0) throw new AppError('VALIDATION_ERROR', `unknown channel ${request.channel}`);
  const { email, party_size, details } = validateFields(channels[0], request.fields);

  // One transaction on one client. Locking the trail row makes bookings for the same trail
  // run one at a time, so two requests can never both take the last spots.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: trails } = await client.query<{ status: string; daily_quota: number }>(
      'SELECT status, daily_quota FROM trails WHERE code = $1 FOR UPDATE',
      [request.trail],
    );
    const trail = trails[0];
    if (!trail) throw new AppError('VALIDATION_ERROR', `unknown trail ${request.trail}`);
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
      [request.idempotency_key, request.trail, request.date, party_size, request.channel, email, details],
    );

    await client.query('COMMIT');
    return inserted[0];
  } catch (error) {
    await client.query('ROLLBACK');
    const pgError = error as { code?: string; constraint?: string };
    if (pgError.code === UNIQUE_VIOLATION && pgError.constraint === 'permits_one_active_per_person') {
      throw new AppError('DUPLICATE_BOOKING');
    }
    throw error;
  } finally {
    client.release();
  }
}
