import express from 'express';
import { errorHandler } from './http';
import { trailsRouter } from './routes/trails';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(trailsRouter);
  app.use(errorHandler);
  return app;
}
