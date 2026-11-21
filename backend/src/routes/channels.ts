import { Router } from 'express';
import { pool } from '../db';
import { route } from '../http';

export const channelsRouter = Router();

channelsRouter.get(
  '/channels',
  route('GET /channels', async (_req, res) => {
    const { rows } = await pool.query('SELECT id, label, max_party, fields FROM channels ORDER BY id');
    res.json(rows);
  }),
);
