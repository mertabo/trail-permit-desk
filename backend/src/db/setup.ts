import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pool } from '../db';
import { logger } from '../logger';

// Drops and recreates the tables from db/schema.sql.
async function setup() {
  const schema = readFileSync(join(__dirname, '../../db/schema.sql'), 'utf8');
  await pool.query(schema);
  logger.info('Database schema applied');
}

setup()
  .catch((error) => {
    logger.error('Database setup failed', { error: String(error) });
    process.exitCode = 1;
  })
  .finally(() => pool.end());
