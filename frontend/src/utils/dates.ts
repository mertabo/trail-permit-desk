import { TIMEZONE } from '@/config'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export type MonthGroup = {
  month: string // e.g. "Nov"
  monthNumber: number // 1-12, used to build the full date
  year: number
  days: number[]
}

/** Builds a 'YYYY-MM-DD' date string. */
export function toDateString(year: number, monthNumber: number, day: number): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${year}-${pad(monthNumber)}-${pad(day)}`
}

/**
 * Returns `days` dates starting today (in the park's timezone), grouped by month:
 * [{ month: "Nov", monthNumber: 11, year: 2026, days: [28, 29, 30] }, { month: "Dec", ... }]
 * `now` is a parameter so tests don't depend on the current time.
 */
export function computeDateRange(days: number, now: Date): MonthGroup[] {
  // The en-CA locale formats dates as YYYY-MM-DD.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(now)
  const [year, month, day] = today.split('-').map(Number) as [number, number, number]

  const groups: MonthGroup[] = []
  for (let offset = 0; offset < days; offset++) {
    // Pure calendar math in UTC, so no timezone can shift the day.
    const date = new Date(Date.UTC(year, month - 1, day + offset))
    const monthNumber = date.getUTCMonth() + 1
    const last = groups[groups.length - 1]
    if (last && last.monthNumber === monthNumber && last.year === date.getUTCFullYear()) {
      last.days.push(date.getUTCDate())
    } else {
      groups.push({
        month: MONTH_NAMES[monthNumber - 1]!,
        monthNumber,
        year: date.getUTCFullYear(),
        days: [date.getUTCDate()],
      })
    }
  }
  return groups
}
