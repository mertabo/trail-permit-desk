import type { Channel, ChannelField } from '../data/channels';
import { AppError } from '../errors';

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isEmpty = (value: unknown) => value === undefined || value === null || value === '';

/** Returns what's wrong with one field value, or null if it's fine. Mirrors the form's checks. */
function findProblem(field: ChannelField, value: unknown): string | null {
  if (field.type === 'checkbox') {
    if (value !== undefined && value !== null && typeof value !== 'boolean') return 'must be true or false';
    return field.required && value !== true ? 'is required' : null;
  }
  if (isEmpty(value)) return field.required ? 'is required' : null;

  if (field.type === 'number') {
    if (typeof value !== 'number' || !Number.isInteger(value)) return 'must be a whole number';
    if (field.min !== undefined && value < field.min) return `must be at least ${field.min}`;
    return null;
  }

  if (typeof value !== 'string') return 'must be text';
  if (field.type === 'email' && !EMAIL_FORMAT.test(value.trim())) return 'must be a valid email';
  if (field.type === 'select' && !field.options?.some((option) => option.value === value)) {
    return 'must be one of the options';
  }
  if (field.max_length !== undefined && value.length > field.max_length) {
    return `must be ${field.max_length} characters or fewer`;
  }
  if (field.pattern && !new RegExp(field.pattern).test(value)) return `must match ${field.pattern}`;
  return null;
}

/**
 * Checks the submitted fields against the channel's definitions, so requests that skip the
 * frontend get the same checks. Fields the channel doesn't define are dropped.
 * email and party_size are returned separately because they're stored in their own columns.
 */
export function validateFields(channel: Channel, fields: unknown) {
  if (typeof fields !== 'object' || fields === null || Array.isArray(fields)) {
    throw new AppError('VALIDATION_ERROR', 'fields must be an object');
  }
  const input = fields as Record<string, unknown>;

  let email: string | null = null;
  let partySize = 0;
  const details: Record<string, unknown> = {};

  for (const field of channel.fields) {
    const value = input[field.key];
    const problem = findProblem(field, value);
    if (problem) throw new AppError('VALIDATION_ERROR', `${field.key} ${problem}`);
    if (isEmpty(value)) continue; // an optional field left empty

    if (field.key === 'email') email = (value as string).trim().toLowerCase();
    else if (field.key === 'party_size') partySize = value as number;
    else details[field.key] = value;
  }

  if (partySize > channel.max_party) {
    throw new AppError('VALIDATION_ERROR', `party_size must be at most ${channel.max_party} for ${channel.id}`);
  }

  return { email, party_size: partySize, details };
}
