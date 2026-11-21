import type { Channel } from '@/services/channels'
import type { TrailAvailability } from '@/services/trails'

/** The largest party this channel can book on this trail: its max_party, or fewer if the trail is nearly full. */
export function availableSlots(trail: TrailAvailability, channel: Channel): number {
  return Math.min(channel.max_party, hikersAvailable(trail))
}

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
