import { createApp } from './app';
import { PORT } from './config';
import { logger } from './logger';

createApp().listen(PORT, () => {
  logger.info('Server started', { port: PORT });
});
