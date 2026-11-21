// All user-facing text for the backend's error codes lives here.
export const GENERIC_ERROR = 'Something went wrong. Please try again later.'

const MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: "Some details aren't valid. Please check the form and try again.",
  PERMIT_NOT_FOUND: "We couldn't find this permit. It may have been removed.",
  PERMIT_EXPIRED: "This permit has expired, so it can't be cancelled.",
  TRAIL_CLOSED: 'This trail is currently closed. Please choose another trail.',
  TRAIL_FULL:
    "There aren't enough spots left on this trail for your party. Try a smaller party, another date, or another trail.",
  DUPLICATE_BOOKING: 'You already have a permit for this trail on this date.',
  SERVER_ERROR: GENERIC_ERROR,
}

/** The plain-language message for an error code. Unknown codes get the generic message. */
export function errorMessage(code: string | null | undefined): string {
  return (code && MESSAGES[code]) || GENERIC_ERROR
}
