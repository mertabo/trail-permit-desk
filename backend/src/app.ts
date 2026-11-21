import express from 'express';
import { errorHandler } from './http';
import type { SaveDependencies } from './permits/savePermit';
import { channelsRouter } from './routes/channels';
import { createPermitsRouter } from './routes/permits';
import { trailsRouter } from './routes/trails';

/** `saveDependencies` lets tests swap in a database connection that fails on purpose. */
export function createApp(saveDependencies?: SaveDependencies) {
  const app = express();
  app.use(express.json());
  app.use(trailsRouter);
  app.use(channelsRouter);
  app.use(createPermitsRouter(saveDependencies));
  app.use(errorHandler);
  return app;
}
