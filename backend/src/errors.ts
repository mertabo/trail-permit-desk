// The one mapping of error code -> HTTP status. The backend only ever sends these codes;
// the frontend turns each one into a plain-language message.
export const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  PERMIT_NOT_FOUND: 404,
  PERMIT_EXPIRED: 409,
  TRAIL_CLOSED: 409,
  TRAIL_FULL: 409,
  DUPLICATE_BOOKING: 409,
  SERVER_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

/** An expected error with a known code. `detail` is logged, never sent to the client. */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    detail?: string,
  ) {
    super(detail ?? code);
  }
}
