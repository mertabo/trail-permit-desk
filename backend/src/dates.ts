// Must match TIMEZONE and BOOKING_WINDOW_DAYS in the frontend.
export const TIMEZONE = 'Asia/Manila';
export const BOOKING_WINDOW_DAYS = 31; // today plus the next 30 days

/** Today's date in the park's timezone, as 'YYYY-MM-DD'. */
export function today(now: Date = new Date()): string {
  // The en-CA locale formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(now);
}

/** Adds (or subtracts) whole days to a 'YYYY-MM-DD' date. Pure calendar math, no timezones. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${result.getUTCFullYear()}-${pad(result.getUTCMonth() + 1)}-${pad(result.getUTCDate())}`;
}

/** True if the date is between today and today + 30 (the booking window). */
export function isInBookingWindow(date: string, now: Date = new Date()): boolean {
  const first = today(now);
  return date >= first && date <= addDays(first, BOOKING_WINDOW_DAYS - 1);
}

/** True if the string is a real calendar date in 'YYYY-MM-DD' form. */
export function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return addDays(value, 0) === value; // rejects e.g. 2026-02-30, which rolls over to March
}
