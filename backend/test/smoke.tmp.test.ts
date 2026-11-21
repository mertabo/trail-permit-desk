import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app';
import { pool } from '../src/db';

beforeAll(async () => {
  await pool.query(readFileSync(join(__dirname, '../db/smoke.tmp.sql'), 'utf8'));
});

afterAll(async () => {
  await pool.end();
});

test('GET /smoke returns the message from the database', async () => {
  const response = await request(createApp()).get('/smoke');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ message: 'Hello from Postgres' });
});
