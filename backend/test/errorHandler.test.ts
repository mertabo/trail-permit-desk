import express from 'express';
import request from 'supertest';
import { errorHandler, route } from '../src/http';

test('an unexpected error returns 500 SERVER_ERROR', async () => {
  const app = express();
  app.get(
    '/broken',
    route('GET /broken', async () => {
      throw new Error('something nobody expected');
    }),
  );
  app.use(errorHandler);

  const response = await request(app).get('/broken');

  expect(response.status).toBe(500);
  expect(response.body).toEqual({ code: 'SERVER_ERROR' });
});
