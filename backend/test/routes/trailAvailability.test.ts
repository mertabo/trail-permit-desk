import request from 'supertest';
import { createApp } from '../../src/app';
import { addDays, today } from '../../src/dates';
import { pool } from '../../src/db';
import { insertChannels, insertPermit, insertTrail, resetDatabase } from '../helpers/db';

const app = createApp();
const date = addDays(today(), 1);

beforeEach(async () => {
  await resetDatabase();
  await insertChannels();
});

afterAll(() => pool.end());

const getAvailability = (date: string) => request(app).get('/trails/availability').query({ date });

test('counts only active permits', async () => {
  await insertTrail({ code: 'RDG-01', daily_quota: 10 });
  await insertPermit({ trail: 'RDG-01', date, party_size: 3 });
  await insertPermit({ trail: 'RDG-01', date, party_size: 4, status: 'cancelled' });
  await insertPermit({ trail: 'RDG-01', date: addDays(date, 1), party_size: 5 }); // another day

  const response = await getAvailability(date);

  expect(response.status).toBe(200);
  expect(response.body).toEqual([
    { code: 'RDG-01', name: 'Trail RDG-01', daily_quota: 10, status: 'open', booked_hikers: 3 },
  ]);
});

test('includes trails with no permits and closed trails (with their booked count)', async () => {
  await insertTrail({ code: 'EMP-01' });
  await insertTrail({ code: 'MOS-05', status: 'closed', daily_quota: 30 });
  await insertPermit({ trail: 'MOS-05', date, party_size: 2 });

  const response = await getAvailability(date);

  expect(response.body).toEqual([
    expect.objectContaining({ code: 'EMP-01', booked_hikers: 0 }),
    expect.objectContaining({ code: 'MOS-05', status: 'closed', booked_hikers: 2 }),
  ]);
});

test.each([
  ['yesterday', addDays(today(), -1)],
  ['today + 31', addDays(today(), 31)],
  ['not a date', 'abc'],
])('a date outside the booking window (%s) returns VALIDATION_ERROR', async (_label, badDate) => {
  const response = await getAvailability(badDate);

  expect(response.status).toBe(400);
  expect(response.body).toEqual({ code: 'VALIDATION_ERROR' });
});
