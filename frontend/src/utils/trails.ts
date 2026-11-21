import type { TrailAvailability } from '@/services/trails'

/** Hikers that can still book this trail on the chosen date. Never below 0. */
export function hikersAvailable(trail: TrailAvailability): number {
  return Math.max(0, trail.daily_quota - trail.booked_hikers)
}

export function isFull(trail: TrailAvailability): boolean {
  return trail.booked_hikers >= trail.daily_quota
}

/** The trail's name, or its code when it has no name. */
export function trailLabel(trail: Pick<TrailAvailability, 'code' | 'name'>): string {
  return trail.name || trail.code
}
