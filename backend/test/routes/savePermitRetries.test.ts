import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../../src/app';
import { addDays, today } from '../../src/dates';
import { pool } from '../../src/db';
import type { Db } from '../../src/permits/savePermit';
import { insertChannels, insertPermit, insertTrail, resetDatabase } from '../helpers/db';

const date = addDays(today(), 1);

beforeEach(async () => {
  await resetDatabase();
  await insertChannels();
  await insertTrail({ code: 'RDG-01', daily_quota: 10 });
});

afterAll(() => pool.end());

/**
 * A real database connection whose queries go through `intercept` first, so a test can make
 * a query fail at an exact moment. `run()` sends the query to the real database.
 */
function fakeDb(intercept: (sql: string, run: () => Promise<unknown>) => Promise<unknown>) {
  const stats = { connections: 0 };
  const db = {
    async connect() {
      stats.connections++;
      const client = await pool.connect();
      return {
        query: (sql: string, values?: unknown[]) => intercept(sql, () => client.query(sql, values)),
        release: (error?: Error) => client.release(error),
      };
    },
  } as unknown as Db;
  return { db, stats };
}

function setup(intercept: Parameters<typeof fakeDb>[0]) {
  const { db, stats } = fakeDb(intercept);
  const waits: number[] = [];
  const app = createApp({ db, sleep: async (ms) => void waits.push(ms) });
  return { app, stats, waits };
}

const body = () => ({
  idempotency_key: randomUUID(),
  trail: 'RDG-01',
  date,
  channel: 'online',
  fields: { lead_name: 'Ana', email: `${randomUUID()}@example.com`, party_size: 2, emergency_phone: '+63 912' },
});

async function permitCount() {
  const { rows } = await pool.query('SELECT count(*)::int AS count FROM permits');
  return rows[0].count as number;
}

const deadlock = () => Object.assign(new Error('deadlock detected'), { code: '40P01' });

test('temporary error, then success → one permit', async () => {
  let failed = false;
  const { app, stats } = setup(async (sql, run) => {
    if (sql.startsWith('INSERT') && !failed) {
      failed = true;
      throw deadlock();
    }
    return run();
  });

  const response = await request(app).post('/permits').send(body());

  expect(response.status).toBe(201);
  expect(stats.connections).toBe(2);
  expect(await permitCount()).toBe(1);
});

test('commit succeeded but the connection dropped → the retry finds the key, returns success, one permit', async () => {
  let dropped = false;
  const { app, stats } = setup(async (sql, run) => {
    const result = await run();
    if (sql === 'COMMIT' && !dropped) {
      dropped = true;
      throw new Error('Connection terminated unexpectedly'); // the permit IS saved, but we never hear back
    }
    return result;
  });
  const sent = body();

  const response = await request(app).post('/permits').send(sent);

  expect(response.status).toBe(201);
  expect(response.body.idempotency_key).toBe(sent.idempotency_key);
  expect(stats.connections).toBe(2);
  expect(await permitCount()).toBe(1);
});

test('business errors are not retried (TRAIL_FULL is returned after one attempt)', async () => {
  await insertPermit({ trail: 'RDG-01', date, party_size: 10 });
  const { app, stats } = setup((_sql, run) => run());

  const response = await request(app).post('/permits').send(body());

  expect(response.body).toEqual({ code: 'TRAIL_FULL' });
  expect(stats.connections).toBe(1);
});

test('gives up after 1 + 3 attempts → SERVER_ERROR', async () => {
  const { app, stats, waits } = setup(async (sql, run) => {
    if (sql === 'BEGIN') throw Object.assign(new Error('could not serialize access'), { code: '40001' });
    return run();
  });

  const response = await request(app).post('/permits').send(body());

  expect(response.status).toBe(500);
  expect(response.body).toEqual({ code: 'SERVER_ERROR' });
  expect(stats.connections).toBe(4);
  expect(waits).toEqual([100, 200, 400]);
  expect(await permitCount()).toBe(0);
});
