import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PoolClient } from 'pg';
import { validateChannels } from '../data/channels';
import { generatePermits, PermitRow } from '../data/generatePermits';
import { prepareTrails } from '../data/prepareTrails';
import { BOOKING_WINDOW_DAYS, today } from '../dates';
import { pool } from '../db';
import { logger } from '../logger';

// At least 50,000 past permits, so the email search can be measured.
// Raise PAST_PERMITS to measure search at larger volumes.
const PAST_PERMITS = 50_000;
const PAST_DAYS = 730; // past permits are spread over the last 24 months
const UPCOMING_PERMITS = 1_000;
const EMAIL_POOL_SIZE = 3_000; // each email ends up with several permits
const BATCH_SIZE = 5_000;

const readData = (file: string) => JSON.parse(readFileSync(join(__dirname, '../../../data', file), 'utf8'));

async function seed() {
  const channels = validateChannels(readData('channels.json'));

  const { valid: trails, rejected, duplicates } = prepareTrails(readData('trails.json'));
  for (const { record, reason } of rejected) {
    logger.info('Trail rejected', { code: record.code, reason });
  }

  const permits = generatePermits({
    trails,
    channels,
    today: today(),
    pastCount: PAST_PERMITS,
    pastDays: PAST_DAYS,
    upcomingCount: UPCOMING_PERMITS,
    upcomingDays: BOOKING_WINDOW_DAYS,
    emailPoolSize: EMAIL_POOL_SIZE,
  });

  // Everything runs in one transaction: the seed either fully succeeds or changes nothing.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE permits, trails, channels RESTART IDENTITY');

    for (const channel of channels) {
      await client.query('INSERT INTO channels (id, label, max_party, fields) VALUES ($1, $2, $3, $4)', [
        channel.id,
        channel.label,
        channel.max_party,
        JSON.stringify(channel.fields),
      ]);
    }

    for (const trail of trails) {
      await client.query(
        'INSERT INTO trails (code, name, daily_quota, status, updated_at) VALUES ($1, $2, $3, $4, $5)',
        [trail.code, trail.name, trail.daily_quota, trail.status, trail.updated_at],
      );
    }

    for (let start = 0; start < permits.length; start += BATCH_SIZE) {
      await insertPermits(client, permits.slice(start, start + BATCH_SIZE));
    }

    await checkNothingIsOverQuota(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const todayDate = today();
  logger.info('Seed finished', {
    channels: channels.length,
    trails: { inserted: trails.length, deduplicated: duplicates.length, rejected: rejected.length },
    permits: {
      total: permits.length,
      past: permits.filter((p) => p.date < todayDate).length,
      upcoming: permits.filter((p) => p.date >= todayDate).length,
      active: permits.filter((p) => p.status === 'active').length,
      cancelled: permits.filter((p) => p.status === 'cancelled').length,
    },
  });
}

/** Inserts a batch of permits in one query, passing one array per column. */
async function insertPermits(client: PoolClient, batch: PermitRow[]) {
  await client.query(
    `INSERT INTO permits (idempotency_key, trail, date, party_size, status, channel, email, details)
     SELECT * FROM unnest($1::uuid[], $2::text[], $3::date[], $4::int[], $5::text[], $6::text[], $7::text[], $8::jsonb[])`,
    [
      batch.map((p) => p.idempotency_key),
      batch.map((p) => p.trail),
      batch.map((p) => p.date),
      batch.map((p) => p.party_size),
      batch.map((p) => p.status),
      batch.map((p) => p.channel),
      batch.map((p) => p.email),
      batch.map((p) => JSON.stringify(p.details)),
    ],
  );
}

/** Safety net: fails the seed (and rolls it back) if any trail and date is over its quota. */
async function checkNothingIsOverQuota(client: PoolClient) {
  const { rows } = await client.query(`
    SELECT p.trail, p.date
    FROM permits p JOIN trails t ON t.code = p.trail
    WHERE p.status = 'active'
    GROUP BY p.trail, p.date, t.daily_quota
    HAVING SUM(p.party_size) > t.daily_quota`);
  if (rows.length > 0) throw new Error(`Seed would over-issue ${rows.length} trail/date(s)`);
}

seed()
  .catch((error) => {
    logger.error('Seed failed', { error: String(error) });
    process.exitCode = 1;
  })
  .finally(() => pool.end());
