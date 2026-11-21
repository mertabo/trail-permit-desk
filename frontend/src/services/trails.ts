import { request } from './api'

export type TrailAvailability = {
  code: string
  name: string | null
  daily_quota: number
  status: 'open' | 'closed'
  booked_hikers: number
}

export function fetchTrailAvailability(date: string) {
  return request<TrailAvailability[]>(`/trails/availability?date=${encodeURIComponent(date)}`)
}
