import { today } from '../dates';
import { pool } from '../db';
import { AppError } from '../errors';

export const PAGE_SIZE = 10;

/** Parses the `page` query value. Missing means page 1; anything but a whole number >= 1 is invalid. */
function parsePage(value: unknown): number {
  if (value === undefined) return 1;
  if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) < 1) {
    throw new AppError('VALIDATION_ERROR', 'page must be a whole number from 1');
  }
  return Number(value);
}

/**
 * All permits for an email (past and future, any status), newest date first, 10 per page.
 * The match is exact and case-insensitive: emails are stored lowercased, so the search is too.
 */
export async function searchPermits(query: { email?: unknown; page?: unknown }) {
  if (typeof query.email !== 'string' || query.email.trim() === '') {
    throw new AppError('VALIDATION_ERROR', 'email is required');
  }
  const email = query.email.trim().toLowerCase();
  const page = parsePage(query.page);

  // "expired" isn't stored: an active permit whose date has passed is shown as expired.
  // id is a tiebreaker for permits on the same date, so pages never repeat or skip rows.
  const { rows: items } = await pool.query(
    `SELECT p.id, p.trail, t.name AS trail_name, t.status AS trail_status, p.date, p.party_size,
            CASE WHEN p.status = 'active' AND p.date < $2 THEN 'expired' ELSE p.status END AS status
     FROM permits p
     JOIN trails t ON t.code = p.trail
     WHERE p.email = $1
     ORDER BY p.date DESC, p.id DESC
     LIMIT $3 OFFSET $4`,
    [email, today(), PAGE_SIZE, (page - 1) * PAGE_SIZE],
  );
  const { rows } = await pool.query('SELECT count(*)::int AS total FROM permits WHERE email = $1', [email]);

  return { items, total: rows[0].total as number, page, page_size: PAGE_SIZE };
}
