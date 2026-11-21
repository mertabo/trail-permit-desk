import { computeDateRange } from './dates'

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

test('returns 31 days, grouped correctly across a month and year boundary (Dec → Jan)', () => {
  // Noon on Dec 20 in the Philippines.
  const groups = computeDateRange(31, new Date('2026-12-20T04:00:00Z'))

  expect(groups).toEqual([
    { month: 'Dec', monthNumber: 12, year: 2026, days: range(20, 31) },
    { month: 'Jan', monthNumber: 1, year: 2027, days: range(1, 19) },
  ])
  expect(groups.flatMap((group) => group.days)).toHaveLength(31)
})

test('uses Philippine time: at 16:30 UTC the range already starts on the next day', () => {
  // 16:30 UTC on Nov 21 is 00:30 on Nov 22 in the Philippines (UTC+8).
  const [first] = computeDateRange(31, new Date('2026-11-21T16:30:00Z'))

  expect(first).toMatchObject({ month: 'Nov', year: 2026 })
  expect(first?.days[0]).toBe(22)
})
