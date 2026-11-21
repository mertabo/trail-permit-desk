import { isValidDate } from '../dates';
import { logger } from '../logger';
import { applyTransformers, Transformer } from './applyTransformers';

export type Trail = {
  code: string;
  name: string | null;
  daily_quota: number;
  status: 'open' | 'closed';
  updated_at: string;
};

type RawRecord = Record<string, unknown>;

export type PreparedTrails = {
  valid: Trail[];
  rejected: { record: RawRecord; reason: string }[];
  duplicates: RawRecord[]; // older records replaced by a later one with the same code
};

const trim = (value: unknown) => (typeof value === 'string' ? value.trim() : value);

const transformers: Record<string, Transformer> = {
  // Codes are case-insensitive: "rdg-01" and "RDG-01" are the same trail.
  code: (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value),
  // An empty name carries no information. The frontend shows the code instead.
  name: (value) => (trim(value) === '' ? null : trim(value)),
  // "25" clearly means 25. Anything else is left as-is and rejected by validation.
  daily_quota: (value) => (typeof value === 'string' && /^\s*\d+\s*$/.test(value) ? Number(value) : value),
  // "Open" is a casing typo, not a third status.
  status: (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  updated_at: trim,
};

/** Returns why a cleaned trail is invalid, or null if it's valid. */
function findProblem(trail: RawRecord): string | null {
  const quota = trail.daily_quota;
  if (quota === null || quota === undefined) return 'daily_quota missing';
  if (typeof quota !== 'number' || !Number.isInteger(quota) || quota < 0) {
    return 'daily_quota must be a whole number >= 0';
  }
  if (trail.status !== 'open' && trail.status !== 'closed') return 'status must be open or closed';
  if (!isValidDate(trail.updated_at)) return 'updated_at must be a YYYY-MM-DD date';
  return null;
}

/**
 * Turns the raw trails.json content into trails ready to insert:
 * 1. clean each record, 2. keep the latest record per code, 3. reject invalid ones.
 * Pure (no database), so it can be tested on the real file.
 */
export function prepareTrails(file: unknown): PreparedTrails {
  const records = (file as { trails?: unknown })?.trails;
  if (!Array.isArray(records)) throw new Error('trails.json has no "trails" array');

  const rejected: PreparedTrails['rejected'] = [];
  const duplicates: RawRecord[] = [];
  const latestByCode = new Map<string, RawRecord>();

  for (const raw of records as RawRecord[]) {
    const trail = applyTransformers(transformers, raw);

    // A record without a code can't be matched to a trail, so it's rejected straight away.
    if (typeof trail.code !== 'string' || trail.code === '') {
      rejected.push({ record: raw, reason: 'code missing' });
      continue;
    }

    // The later updated_at wins. On a tie, the record that comes later in the file wins.
    const current = latestByCode.get(trail.code);
    if (current) {
      if (trail.updated_at === current.updated_at) {
        logger.info('Two trail records have the same updated_at, keeping the later one in the file', {
          code: trail.code,
        });
      }
      const laterWins = String(trail.updated_at) >= String(current.updated_at);
      duplicates.push(laterWins ? current : trail);
      if (!laterWins) continue;
    }
    latestByCode.set(trail.code, trail);
  }

  // Validation runs after deduplication: if the latest record is invalid, the trail is rejected.
  // There's no fallback to an older record, because the older one is out of date.
  const valid: Trail[] = [];
  for (const trail of latestByCode.values()) {
    const problem = findProblem(trail);
    if (problem) rejected.push({ record: trail, reason: problem });
    else valid.push(trail as Trail);
  }

  return { valid, rejected, duplicates };
}
