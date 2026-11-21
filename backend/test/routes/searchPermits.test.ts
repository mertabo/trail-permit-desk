import request from 'supertest';
import { createApp } from '../../src/app';
import { addDays, today } from '../../src/dates';
import { pool } from '../../src/db';
import { insertChannels, insertPermit, insertTrail, resetDatabase } from '../helpers/db';

const app = createApp();
const search = (query: Record<string, string>) => request(app).get('/permits/search').query(query);

beforeEach(async () => {
  await resetDatabase();
  await insertChannels();
  await insertTrail({ code: 'RDG-01', daily_quota: 50 });
});

afterAll(() => pool.end());

test.each([
  ['active + yesterday', 'active', -1, 'expired'],
  ['active + today', 'active', 0, 'active'],
  ['cancelled + past', 'cancelled', -5, 'cancelled'],
] as const)('status is computed correctly: %s → %s', async (_label, stored, daysFromToday, shown) => {
  await insertPermit({ trail: 'RDG-01', date: addDays(today(), daysFromToday), status: stored, email: 'ana@example.com' });

  const response = await search({ email: 'ana@example.com' });

  expect(response.status).toBe(200);
  expect(response.body.items[0].status).toBe(shown);
});

test('page 2 continues with no overlap and no gaps, and total is right', async () => {
  // 15 permits, 8 of them on the same date, so the order depends on the id tiebreaker.
  const sameDate = addDays(today(), 3);
  for (let i = 0; i < 8; i++) {
    await insertPermit({ trail: 'RDG-01', date: sameDate, status: 'cancelled', email: 'ana@example.com' });
  }
  for (let i = 1; i <= 7; i++) {
    await insertPermit({ trail: 'RDG-01', date: addDays(today(), -i), email: 'ana@example.com' });
  }

  const page1 = (await search({ email: 'ana@example.com', page: '1' })).body;
  const page2 = (await search({ email: 'ana@example.com', page: '2' })).body;

  expect(page1).toMatchObject({ total: 15, page: 1, page_size: 10 });
  expect(page1.items).toHaveLength(10);
  expect(page2.items).toHaveLength(5);
  const both: { id: number; date: string }[] = [...page1.items, ...page2.items];
  expect(new Set(both.map((permit) => permit.id)).size).toBe(15); // no repeats, nothing missing

  // Newest date first, then highest id first within the same date.
  const newestFirst = (a: { id: number; date: string }, b: { id: number; date: string }) =>
    a.date === b.date ? b.id - a.id : b.date.localeCompare(a.date);
  expect(both).toEqual([...both].sort(newestFirst));
});

test('matches the email regardless of casing or spaces, but only exactly', async () => {
  await insertPermit({ trail: 'RDG-01', date: today(), email: 'ben@x.com' });

  expect((await search({ email: '  BEN@X.com ' })).body.total).toBe(1);
  expect((await search({ email: 'ben@x.co' })).body.total).toBe(0);
});

test.each(['0', '-1', 'abc'])('invalid page (%s) → VALIDATION_ERROR', async (page) => {
  const response = await search({ email: 'ana@example.com', page });

  expect(response.status).toBe(400);
  expect(response.body).toEqual({ code: 'VALIDATION_ERROR' });
});
