import type { ErrorRequestHandler, Request, RequestHandler, Response } from 'express';
import { AppError, ERROR_STATUS } from './errors';
import { logger } from './logger';

/** Wraps an endpoint so it logs when it's called and when it succeeds. Errors go to errorHandler. */
export function route(name: string, handler: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return async (req, res, next) => {
    logger.info(`${name} called`);
    try {
      await handler(req, res);
      logger.info(`${name} succeeded`, { status: res.statusCode });
    } catch (error) {
      next(error);
    }
  };
}

/** Turns every error into `{ code }` with the right status, and logs it. */
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const name = `${req.method} ${req.path}`;

  if (error instanceof AppError) {
    logger.info(`${name} failed`, { code: error.code, detail: error.message });
    res.status(ERROR_STATUS[error.code]).json({ code: error.code });
    return;
  }

  // A request body that isn't valid JSON is the client's mistake, not a server error.
  if (error?.type === 'entity.parse.failed') {
    logger.info(`${name} failed`, { code: 'VALIDATION_ERROR', detail: 'body is not valid JSON' });
    res.status(400).json({ code: 'VALIDATION_ERROR' });
    return;
  }

  logger.error(`${name} failed`, { code: 'SERVER_ERROR', error: String(error) });
  res.status(500).json({ code: 'SERVER_ERROR' });
};
