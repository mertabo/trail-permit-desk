import { request } from './api'

export type ChannelField = {
  key: string
  label: string
  type: string // text, email, number, tel, checkbox, select, textarea
  required: boolean
  min?: number
  max_length?: number
  pattern?: string
  options?: { value: string; label: string }[]
}

export type Channel = {
  id: string
  label: string
  max_party: number
  fields: ChannelField[]
}

export function fetchChannels() {
  return request<Channel[]>('/channels')
}
