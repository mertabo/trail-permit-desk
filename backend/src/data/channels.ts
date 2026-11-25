export const FIELD_TYPES = ['text', 'email', 'number', 'tel', 'checkbox', 'select', 'textarea'] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export type ChannelField = {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  min?: number;
  max_length?: number;
  pattern?: string;
  options?: { value: string; label: string }[];
};

export type Channel = {
  id: string;
  label: string;
  max_party: number;
  fields: ChannelField[];
};

/**
 * Checks channels.json before it's inserted. Throws with every problem found, so a broken
 * config stops the seed instead of producing a form the backend can't save.
 */
export function validateChannels(file: unknown): Channel[] {
  const channels = (file as { channels?: unknown })?.channels;
  if (!Array.isArray(channels)) throw new Error('channels.json has no "channels" array');

  const problems: string[] = [];
  for (const channel of channels as Channel[]) {
    const keys = channel.fields.map((field) => field.key);

    for (const field of channel.fields) {
      if (!FIELD_TYPES.includes(field.type)) {
        problems.push(`${channel.id}: field "${field.key}" has unsupported type "${field.type}"`);
      }
    }
    for (const key of new Set(keys)) {
      if (keys.filter((k) => k === key).length > 1) problems.push(`${channel.id}: field key "${key}" is repeated`);
    }

    if (channel.id === 'school') {
      const studentsField = channel.fields.find(field => field.key === 'students')
      const chaperonesField = channel.fields.find(field => field.key === 'chaperones')

      // both should exist, both should be required and has type number
      if (studentsField && chaperonesField && studentsField?.type === 'number' && studentsField.required) continue
      problems.push(`${channel.id}: needs required "students" and "chaperones" fields of type number`);
    }

    // party_size is stored in its own column and drives the quota, so every channel needs it.
    const partySize = channel.fields.find((field) => field.key === 'party_size');
    if (!partySize || partySize.type !== 'number' || !partySize.required) {
      problems.push(`${channel.id}: needs a required "party_size" field of type number`);
    }
  }

  if (problems.length > 0) throw new Error(`Invalid channels.json:\n- ${problems.join('\n- ')}`);
  return channels as Channel[];
}
