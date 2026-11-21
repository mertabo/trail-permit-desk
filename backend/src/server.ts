import { createApp } from './app';
import { PORT } from './config';
import { logger } from './logger';

// In Express 5, a failed listen (e.g. the port is already in use) arrives here as `error`.
createApp().listen(PORT, (error) => {
  if (error) {
    logger.error('Server failed to start', { port: PORT, error: String(error) });
    process.exit(1);
  }
  logger.info('Server started', { port: PORT });
});
