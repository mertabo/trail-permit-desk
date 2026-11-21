import express from 'express';
import { errorHandler } from './http';
import { channelsRouter } from './routes/channels';
import { permitsRouter } from './routes/permits';
import { trailsRouter } from './routes/trails';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(trailsRouter);
  app.use(channelsRouter);
  app.use(permitsRouter);
  app.use(errorHandler);
  return app;
}
