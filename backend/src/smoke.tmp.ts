import { Router } from 'express';
import { pool } from './db';
import { logger } from './logger';

export const smokeRouter = Router();

smokeRouter.get('/smoke', async (_req, res) => {
  logger.info('GET /smoke called');
  try {
    const { rows } = await pool.query('SELECT message FROM smoke_tmp LIMIT 1');
    logger.info('GET /smoke succeeded');
    res.json({ message: rows[0].message });
  } catch (error) {
    logger.error('GET /smoke failed', { error: String(error) });
    res.status(500).json({ code: 'SERVER_ERROR' });
  }
});
