import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { createApp } from '../../src/app';
import { addDays, today } from '../../src/dates';
import { pool } from '../../src/db';
import { insertChannels, insertPermit, insertTrail, resetDatabase } from '../helpers/db';

const date = addDays(today(), 1);
let server: Server;

beforeAll(() => {
  // A real HTTP server on a random port, so concurrent requests really run at the same time.
  server = createApp().listen(0);
});

beforeEach(async () => {
  await resetDatabase();
  await insertChannels();
});

afterAll(async () => {
  server.close();
  await pool.end();
});

/** A valid online request. Each one gets its own idempotency key and email unless overridden. */
function onlineRequest(overrides: { trail?: string; date?: string; party_size?: number; email?: string } = {}) {
  return {
    idempotency_key: randomUUID(),
    trail: overrides.trail ?? 'RDG-01',
    date: overrides.date ?? date,
    channel: 'online',
    fields: {
      lead_name: 'Ana Reyes',
      email: overrides.email ?? `${randomUUID()}@example.com`,
      party_size: overrides.party_size ?? 2,
      emergency_phone: '+63 912 345 6789',
    },
  };
}

/** A valid desk request without an email. */
function deskRequest(party_size: number) {
  return {
    idempotency_key: randomUUID(),
    trail: 'RDG-01',
    date,
    channel: 'desk',
    fields: { lead_name: 'Ben Cruz', party_size, ranger_initials: 'AB' },
  };
}

const save = (body: unknown) => request(server).post('/permits').send(body as object);

async function activeHikers(trail: string) {
  const { rows } = await pool.query(
    "SELECT COALESCE(SUM(party_size), 0)::int AS hikers FROM permits WHERE trail = $1 AND date = $2 AND status = 'active'",
    [trail, date],
  );
  return rows[0].hikers as number;
}

describe('concurrency', () => {
  test('many concurrent requests for the same trail and date never over-issue (repeated 50 times)', async () => {
    const QUOTA = 10;
    await insertTrail({ code: 'RDG-01', daily_quota: QUOTA });

    for (let round = 0; round < 50; round++) {
      await pool.query('DELETE FROM permits');
      // 20 requests for up to 40 hikers, all at once, against a quota of 10.
      const bodies = Array.from({ length: 20 }, () => onlineRequest({ party_size: 1 + Math.floor(Math.random() * 3) }));

      const responses = await Promise.all(bodies.map(save));

      for (const response of responses) {
        expect([201, 409]).toContain(response.status);
        if (response.status === 409) expect(response.body).toEqual({ code: 'TRAIL_FULL' });
      }
      const hikers = await activeHikers('RDG-01');
      expect(hikers).toBeLessThanOrEqual(QUOTA);
      // What the database holds matches exactly what was confirmed to the users.
      const confirmed = responses.filter((r) => r.status === 201).reduce((sum, r) => sum + r.body.party_size, 0);
      expect(hikers).toBe(confirmed);
    }
  });

  test('concurrent requests for different trails all succeed (the lock is per trail, not global)', async () => {
    const codes = ['TR-1', 'TR-2', 'TR-3', 'TR-4', 'TR-5'];
    for (const code of codes) await insertTrail({ code, daily_quota: 2 });

    const responses = await Promise.all(codes.map((trail) => save(onlineRequest({ trail, party_size: 2 }))));

    expect(responses.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
  });
});

describe('booking rules', () => {
  test('closed trail → TRAIL_CLOSED, even with free slots', async () => {
    await insertTrail({ code: 'RDG-01', status: 'closed', daily_quota: 30 });

    const response = await save(onlineRequest());

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ code: 'TRAIL_CLOSED' });
  });

  test('party_size over the remaining quota → TRAIL_FULL', async () => {
    await insertTrail({ code: 'RDG-01', daily_quota: 5 });
    await insertPermit({ trail: 'RDG-01', date, party_size: 4 });

    const response = await save(onlineRequest({ party_size: 2 }));

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ code: 'TRAIL_FULL' });
  });

  test("cancelled permits don't count toward the quota", async () => {
    await insertTrail({ code: 'RDG-01', daily_quota: 5 });
    await insertPermit({ trail: 'RDG-01', date, party_size: 5, status: 'cancelled' });

    const response = await save(onlineRequest({ party_size: 5 }));

    expect(response.status).toBe(201);
  });
});

describe('duplicates', () => {
  beforeEach(() => insertTrail({ code: 'RDG-01', daily_quota: 20 }));

  test('same email, trail and date → DUPLICATE_BOOKING, including with different casing or spaces', async () => {
    expect((await save(onlineRequest({ email: 'ana@example.com' }))).status).toBe(201);

    const response = await save(onlineRequest({ email: '  ANA@Example.com ' }));

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ code: 'DUPLICATE_BOOKING' });
  });

  test('booking again after the first permit was cancelled → accepted', async () => {
    await insertPermit({ trail: 'RDG-01', date, email: 'ana@example.com', status: 'cancelled' });

    const response = await save(onlineRequest({ email: 'ana@example.com' }));

    expect(response.status).toBe(201);
  });

  test('two desk permits without email on the same trail and date → both accepted, both count toward the quota', async () => {
    await pool.query("UPDATE trails SET daily_quota = 4 WHERE code = 'RDG-01'");

    expect((await save(deskRequest(2))).status).toBe(201);
    expect((await save(deskRequest(2))).status).toBe(201);
    // Accepted gap: no duplicate check without an email, but the quota still applies.
    const third = await save(deskRequest(1));
    expect(third.body).toEqual({ code: 'TRAIL_FULL' });
  });
});

describe('validation, sent straight to the API', () => {
  beforeEach(() => insertTrail({ code: 'RDG-01', daily_quota: 20 }));

  const withFields = (fields: Record<string, unknown>) => {
    const body = onlineRequest();
    return { ...body, fields: { ...body.fields, ...fields } };
  };

  test.each([
    ['date in the past', { ...onlineRequest(), date: addDays(today(), -1) }],
    ['date after today + 30', { ...onlineRequest(), date: addDays(today(), 31) }],
    ['unknown trail', { ...onlineRequest(), trail: 'NOPE-99' }],
    ['unknown channel', { ...onlineRequest(), channel: 'carrier-pigeon' }],
    ['party_size of 0', withFields({ party_size: 0 })],
    ['party_size over max_party (online max is 6)', withFields({ party_size: 7 })],
    ['missing required field', withFields({ lead_name: '' })],
    ['pattern mismatch (ranger_initials)', { ...deskRequest(1), fields: { lead_name: 'Ben', party_size: 1, ranger_initials: 'ab' } }],
    [
      'invalid select option',
      {
        ...onlineRequest(),
        channel: 'operator',
        fields: { operator_code: 'XYZ', lead_name: 'Guide', email: 'g@example.com', party_size: 2 },
      },
    ],
  ])('%s → VALIDATION_ERROR', async (_label, body) => {
    const response = await save(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ code: 'VALIDATION_ERROR' });
    expect(await activeHikers('RDG-01')).toBe(0);
  });
});
