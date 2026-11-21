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
