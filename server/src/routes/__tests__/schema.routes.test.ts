import express from 'express';
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { errorHandler } from '../../middleware/errorHandler.js';
import { createSchemaRoutes } from '../schema.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/', createSchemaRoutes());
  app.use(errorHandler);
  return app;
}

describe('GET /api/schema/manifest', () => {
  it('returns 200 with success envelope', async () => {
    const res = await request(buildApp()).get('/manifest');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns data as a JSON Schema object', async () => {
    const res = await request(buildApp()).get('/manifest');
    expect(res.body.data.$schema).toBe('http://json-schema.org/draft-07/schema#');
    expect(res.body.data.type).toBe('object');
    expect(res.body.data.title).toBe('FliDeck Presentation Manifest');
  });
});
