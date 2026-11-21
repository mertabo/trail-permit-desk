import { randomUUID } from 'node:crypto';
import { addDays } from '../dates';
import type { Channel, ChannelField } from './channels';
import type { Trail } from './prepareTrails';

export type PermitRow = {
  idempotency_key: string;
  trail: string;
  date: string;
  party_size: number;
  status: 'active' | 'cancelled';
  channel: string;
  email: string | null;
  details: Record<string, unknown>;
};

type Options = {
  trails: Trail[];
  channels: Channel[];
  today: string;
  pastCount: number; // permits dated from `pastDays` ago up to yesterday
  pastDays: number;
  upcomingCount: number; // permits dated from today up to the end of the booking window
  upcomingDays: number;
  emailPoolSize: number;
  random?: () => number;
};

/**
 * Generates random permits where the active ones follow the booking rules:
 * never over a trail's daily quota, and never a repeated (trail, date, email).
 * Any permit that would break a rule is marked cancelled instead.
 */
export function generatePermits(options: Options): PermitRow[] {
  const random = options.random ?? Math.random;
  const randomInt = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const pick = <T>(items: T[]): T => items[randomInt(0, items.length - 1)];

  const quotaByTrail = new Map(options.trails.map((trail) => [trail.code, trail.daily_quota]));
  const bookedHikers = new Map<string, number>(); // "trail|date" -> hikers in active permits
  const usedEmails = new Set<string>(); // "trail|date|email" already taken by an active permit

  const datesToGenerate = [
    ...Array.from({ length: options.pastCount }, () => addDays(options.today, -randomInt(1, options.pastDays))),
    ...Array.from({ length: options.upcomingCount }, () => addDays(options.today, randomInt(0, options.upcomingDays - 1))),
  ];

  return datesToGenerate.map((date, n) => {
    const trail = pick(options.trails).code;
    const channel = pick(options.channels);
    // Small parties are the most common. Never above the channel's max_party.
    const partySize = randomInt(1, Math.min(channel.max_party, 6));
    const emailField = channel.fields.find((field) => field.key === 'email');
    const hasEmail = emailField && (emailField.required || random() < 0.7);
    const email = hasEmail ? `hiker${randomInt(1, options.emailPoolSize)}@example.com` : null;

    const slot = `${trail}|${date}`;
    const booked = bookedHikers.get(slot) ?? 0;
    const fitsQuota = booked + partySize <= (quotaByTrail.get(trail) ?? 0);
    const isDuplicate = email !== null && usedEmails.has(`${slot}|${email}`);

    let status: PermitRow['status'] = 'cancelled';
    if (fitsQuota && !isDuplicate) {
      status = 'active';
      bookedHikers.set(slot, booked + partySize);
      if (email) usedEmails.add(`${slot}|${email}`);
    }

    return {
      idempotency_key: randomUUID(),
      trail,
      date,
      party_size: partySize,
      status,
      channel: channel.id,
      email,
      details: fakeDetails(channel.fields, n, random),
    };
  });
}

/** Builds valid values for every channel field except email and party_size (stored in their own columns). */
function fakeDetails(fields: ChannelField[], n: number, random: () => number): Record<string, unknown> {
  const details: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.key === 'email' || field.key === 'party_size') continue;
    if (!field.required && random() < 0.5) continue; // optional fields are often left empty
    details[field.key] = fakeValue(field, n, random);
  }
  return details;
}

function fakeValue(field: ChannelField, n: number, random: () => number): unknown {
  const letter = () => String.fromCharCode(65 + Math.floor(random() * 26));
  const digit = () => String(Math.floor(random() * 10));

  switch (field.type) {
    case 'text': {
      if (field.pattern) {
        // The only pattern in channels.json is ranger initials: 2-3 uppercase letters.
        const value = letter() + letter() + (random() < 0.5 ? letter() : '');
        if (!new RegExp(field.pattern).test(value)) {
          throw new Error(`Can't generate a value for "${field.key}" matching ${field.pattern}`);
        }
        return value;
      }
      return `Hiker ${n + 1}`.slice(0, field.max_length);
    }
    case 'tel':
      return `+63 9${Array.from({ length: 9 }, digit).join('')}`;
    case 'checkbox':
      return random() < 0.5;
    case 'select':
      return field.options![Math.floor(random() * field.options!.length)].value;
    case 'textarea':
      return 'Bringing trekking poles.'.slice(0, field.max_length);
    case 'number':
      return field.min ?? 0;
    default:
      throw new Error(`No fake value for field type "${field.type}"`);
  }
}
