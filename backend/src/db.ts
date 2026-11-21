import { Pool, types } from 'pg';
import { DATABASE_URL } from './config';

// Keep DATE columns as 'YYYY-MM-DD' strings. By default pg turns them into JS Dates
// at local midnight, which can shift the day when serialized to JSON.
const POSTGRES_DATE_TYPE = 1082;
types.setTypeParser(POSTGRES_DATE_TYPE, (value) => value);

export const pool = new Pool({ connectionString: DATABASE_URL });
