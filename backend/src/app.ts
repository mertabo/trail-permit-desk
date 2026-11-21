import express from 'express';
import { smokeRouter } from './smoke.tmp';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(smokeRouter);
  return app;
}
