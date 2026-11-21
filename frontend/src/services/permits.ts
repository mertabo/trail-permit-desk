import { request } from './api'

export type Permit = {
  id: number
  idempotency_key: string
  trail: string
  date: string
  party_size: number
  status: 'active' | 'cancelled'
  channel: string
  email: string | null
  details: Record<string, unknown>
  created_at: string
}

export type CreatePermitRequest = {
  idempotency_key: string
  trail: string
  date: string
  channel: string
  fields: Record<string, unknown>
}

export function createPermit(body: CreatePermitRequest) {
  return request<Permit>('/permits', { method: 'POST', body: JSON.stringify(body) })
}

export type PermitSearchItem = {
  id: number
  trail: string
  trail_name: string | null
  trail_status: 'open' | 'closed'
  date: string
  party_size: number
  status: 'active' | 'expired' | 'cancelled' // "expired" is computed by the backend
}

export type PermitSearchResult = {
  items: PermitSearchItem[]
  total: number
  page: number
  page_size: number
}

export function searchPermits(email: string, page: number) {
  return request<PermitSearchResult>(`/permits/search?email=${encodeURIComponent(email)}&page=${page}`)
}
