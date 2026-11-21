import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { prepareTrails } from '../../src/data/prepareTrails';

const realFile = JSON.parse(readFileSync(join(__dirname, '../../../data/trails.json'), 'utf8'));

describe('prepareTrails on the real trails.json', () => {
  const { valid, rejected } = prepareTrails(realFile);
  const trail = (code: string) => valid.find((t) => t.code === code);

  test('returns 7 trails, all codes uppercase', () => {
    expect(valid).toHaveLength(7);
    for (const t of valid) expect(t.code).toBe(t.code.toUpperCase());
  });

  test('rdg-01 / RDG-01: the later record wins whole', () => {
    expect(valid.filter((t) => t.code === 'RDG-01')).toHaveLength(1);
    expect(trail('RDG-01')).toEqual({
      code: 'RDG-01',
      name: 'Ridgeline Loop (new signage)',
      daily_quota: 45,
      status: 'open',
      updated_at: '2026-11-10',
    });
  });

  test('FAL-02: name trimmed, quota "25" becomes 25', () => {
    expect(trail('FAL-02')).toMatchObject({ name: 'Falls Track', daily_quota: 25 });
  });

  test('CAV-04 is rejected with the reason "daily_quota missing"', () => {
    expect(trail('CAV-04')).toBeUndefined();
    expect(rejected).toEqual([
      { record: expect.objectContaining({ code: 'CAV-04' }), reason: 'daily_quota missing' },
    ]);
  });

  test('OLD-07: name null, status "Open" becomes "open"', () => {
    expect(trail('OLD-07')).toMatchObject({ name: null, status: 'open' });
  });
});

test('an invalid latest record rejects the trail, with no fallback to the older one', () => {
  const file = {
    trails: [
      { code: 'ABC-01', name: 'Old', daily_quota: 10, status: 'open', updated_at: '2026-01-01' },
      { code: 'abc-01', name: 'New', daily_quota: null, status: 'open', updated_at: '2026-06-01' },
    ],
  };

  const { valid, rejected } = prepareTrails(file);

  expect(valid).toEqual([]);
  expect(rejected).toEqual([
    { record: expect.objectContaining({ name: 'New' }), reason: 'daily_quota missing' },
  ]);
});
