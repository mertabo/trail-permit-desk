import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateChannels } from '../../src/data/channels';
import { pool } from '../../src/db';

const schema = readFileSync(join(__dirname, '../../db/schema.sql'), 'utf8');

/** Drops and recreates every table in the test database. */
export async function resetDatabase() {
  await pool.query(schema);
}

/** Inserts the real channels from data/channels.json. */
export async function insertChannels() {
  const file = JSON.parse(readFileSync(join(__dirname, '../../../data/channels.json'), 'utf8'));
  for (const channel of validateChannels(file)) {
    await pool.query('INSERT INTO channels (id, label, max_party, fields) VALUES ($1, $2, $3, $4)', [
      channel.id,
      channel.label,
      channel.max_party,
      JSON.stringify(channel.fields),
    ]);
  }
}

export async function insertTrail(trail: { code: string; daily_quota?: number; status?: 'open' | 'closed'; name?: string | null }) {
  await pool.query('INSERT INTO trails (code, name, daily_quota, status, updated_at) VALUES ($1, $2, $3, $4, $5)', [
    trail.code,
    trail.name === undefined ? `Trail ${trail.code}` : trail.name,
    trail.daily_quota ?? 10,
    trail.status ?? 'open',
    '2026-01-01',
  ]);
}

export async function insertPermit(permit: {
  trail: string;
  date: string;
  party_size?: number;
  status?: 'active' | 'cancelled';
  channel?: string;
  email?: string | null;
}) {
  const { rows } = await pool.query(
    `INSERT INTO permits (idempotency_key, trail, date, party_size, status, channel, email, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7, '{}') RETURNING *`,
    [
      randomUUID(),
      permit.trail,
      permit.date,
      permit.party_size ?? 1,
      permit.status ?? 'active',
      permit.channel ?? 'online',
      permit.email === undefined ? `${randomUUID()}@example.com` : permit.email,
    ],
  );
  return rows[0];
}
