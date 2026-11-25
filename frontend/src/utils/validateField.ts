import type { ChannelField } from '@/services/channels'

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const isEmpty = (value: unknown) => value === undefined || value === null || value === ''

/**
 * Checks one field value against its definition from channels.json.
 * Returns the message to show, or null if the value is fine.
 * `max` is an extra limit from outside the config (party_size: the available slots).
 */
export function validateField(field: ChannelField, value: unknown, max?: number): string | null {
  const { label } = field

  if (field.type === 'checkbox') {
    return field.required && value !== true ? `${label} is required.` : null
  }
  if (isEmpty(value)) {
    return field.required ? `${label} is required.` : null
  }

  if (field.type === 'number') {
    if (typeof value !== 'number' || !Number.isInteger(value)) return `${label} must be a whole number.`
    if (field.min !== undefined && value < field.min) return `${label} must be at least ${field.min}.`
    if (max !== undefined && value > max) return `${label} can't be more than ${max}.`
    return null
  }

  const text = String(value)
  if (field.type === 'email' && !EMAIL_FORMAT.test(text.trim())) return 'Enter a valid email address.'
  if (field.type === 'select' && !field.options?.some((option) => option.value === text)) {
    return `Choose a ${label.toLowerCase()} from the list.`
  }
  if (field.max_length !== undefined && text.length > field.max_length) {
    return `${label} must be ${field.max_length} characters or fewer.`
  }
  if (field.pattern && !new RegExp(field.pattern).test(text)) return `${label} isn't in the right format.`
  return null
}

export const validateSchoolFields = (fields: ChannelField[]) => {

  console.log(fields)

}
