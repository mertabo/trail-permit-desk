import { Router } from 'express';
import { isInBookingWindow, isValidDate } from '../dates';
import { pool } from '../db';
import { AppError } from '../errors';
import { route } from '../http';

export const trailsRouter = Router();

trailsRouter.get(
  '/trails/availability',
  route('GET /trails/availability', async (req, res) => {
    const { date } = req.query;
    if (!isValidDate(date) || !isInBookingWindow(date)) {
      throw new AppError('VALIDATION_ERROR', 'date must be a YYYY-MM-DD date from today to today + 30');
    }

    // Starts from trails with a LEFT JOIN, so trails with no permits that day are still listed.
    const { rows } = await pool.query(
      `SELECT t.code, t.name, t.daily_quota, t.status,
              COALESCE(SUM(p.party_size), 0)::int AS booked_hikers
       FROM trails t
       LEFT JOIN permits p
         ON p.trail = t.code AND p.date = $1 AND p.status = 'active'
       GROUP BY t.code
       ORDER BY t.code`,
      [date],
    );
    res.json(rows);
  }),
);
