import { today } from '../dates';
import { pool } from '../db';
import { AppError } from '../errors';

/**
 * Cancels an active permit dated today or later. Its hikers are released right away, and the
 * same person can book that trail and date again (the duplicate index only covers active permits).
 *
 * The request must include the permit's email. There are no accounts, so this is the only check
 * that the caller has any link to the permit. Without it, permit ids are sequential and anyone
 * could cancel every permit by trying ids one after another.
 */
export async function cancelPermit(id: string, body: unknown) {
  // Up to 18 digits keeps the id inside Postgres's BIGINT range.
  if (!/^\d{1,18}$/.test(id)) throw new AppError('VALIDATION_ERROR', 'id must be a whole number');
  const rawEmail = (body as Record<string, unknown> | null)?.email;
  if (typeof rawEmail !== 'string' || rawEmail.trim() === '') {
    throw new AppError('VALIDATION_ERROR', 'email is required');
  }
  const email = rawEmail.trim().toLowerCase();

  // One statement: the check and the change happen together, so no lock is needed. A cancel
  // running during a booking can only lower the booked count, so it can never cause over-issuing.
  const { rowCount } = await pool.query(
    `UPDATE permits SET status = 'cancelled'
     WHERE id = $1 AND email = $2 AND status = 'active' AND date >= $3`,
    [id, email, today()],
  );
  if (rowCount === 1) return;

  // Nothing was updated. Find out why, to return the right answer.
  // A wrong email looks exactly like a missing permit, so it doesn't reveal that the permit exists.
  const { rows } = await pool.query('SELECT status FROM permits WHERE id = $1 AND email = $2', [id, email]);
  const permit = rows[0];
  if (!permit) throw new AppError('PERMIT_NOT_FOUND');
  if (permit.status === 'cancelled') return; // already cancelled: nothing to do, still a success
  throw new AppError('PERMIT_EXPIRED'); // active, but its date has passed
}
