import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../../src/app';
import { addDays, today } from '../../src/dates';
import { pool } from '../../src/db';
import { insertChannels, insertPermit, insertTrail, resetDatabase } from '../helpers/db';

const app = createApp();
const EMAIL = 'ana@example.com';
const cancel = (id: number | string, email: string = EMAIL) =>
  request(app).post(`/permits/${id}/cancel`).send({ email });

beforeEach(async () => {
  await resetDatabase();
  await insertChannels();
  await insertTrail({ code: 'RDG-01', daily_quota: 2 });
});

afterAll(() => pool.end());

async function statusOf(id: number) {
  const { rows } = await pool.query('SELECT status FROM permits WHERE id = $1', [id]);
  return rows[0].status as string;
}

test.each([
  ['today', 0],
  ['a future date', 10],
])('cancels an active permit dated %s', async (_label, daysFromToday) => {
  const permit = await insertPermit({ trail: 'RDG-01', date: addDays(today(), daysFromToday), email: EMAIL });

  const response = await cancel(permit.id);

  expect(response.status).toBe(204);
  expect(response.text).toBe(''); // no body: nothing about the permit is sent back
  expect(await statusOf(permit.id)).toBe('cancelled');
});

test('expired permit → PERMIT_EXPIRED, and it stays active in the database', async () => {
  const permit = await insertPermit({ trail: 'RDG-01', date: addDays(today(), -1), email: EMAIL });

  const response = await cancel(permit.id);

  expect(response.status).toBe(409);
  expect(response.body).toEqual({ code: 'PERMIT_EXPIRED' });
  expect(await statusOf(permit.id)).toBe('active');
});

test('already cancelled → 204, still cancelled', async () => {
  const permit = await insertPermit({ trail: 'RDG-01', date: today(), status: 'cancelled', email: EMAIL });

  const response = await cancel(permit.id);

  expect(response.status).toBe(204);
  expect(await statusOf(permit.id)).toBe('cancelled');
});

test('unknown id → PERMIT_NOT_FOUND', async () => {
  const response = await cancel(999999);

  expect(response.status).toBe(404);
  expect(response.body).toEqual({ code: 'PERMIT_NOT_FOUND' });
});

test("someone else's email → PERMIT_NOT_FOUND, and the permit stays active", async () => {
  const permit = await insertPermit({ trail: 'RDG-01', date: today(), email: EMAIL });

  const response = await cancel(permit.id, 'someone-else@example.com');

  expect(response.status).toBe(404);
  expect(response.body).toEqual({ code: 'PERMIT_NOT_FOUND' });
  expect(await statusOf(permit.id)).toBe('active');
});

test('after cancelling, the freed slots can be booked again, including by the same email', async () => {
  const date = addDays(today(), 1);
  const permit = await insertPermit({ trail: 'RDG-01', date, party_size: 2, email: EMAIL });
  const rebook = {
    idempotency_key: randomUUID(),
    trail: 'RDG-01',
    date,
    channel: 'online',
    fields: { lead_name: 'Ana', email: EMAIL, party_size: 2, emergency_phone: '+63 912' },
  };
  expect((await request(app).post('/permits').send(rebook)).body).toEqual({ code: 'TRAIL_FULL' });

  await cancel(permit.id);
  const response = await request(app).post('/permits').send({ ...rebook, idempotency_key: randomUUID() });

  expect(response.status).toBe(201);
});
