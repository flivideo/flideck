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
    expect(typeof res.body.data).toBe('object');
    expect(Array.isArray(res.body.data)).toBe(false);
    // JSON Schema has $schema or type property
    const hasSchemaMarker =
      res.body.data.$schema !== undefined || res.body.data.type !== undefined;
    expect(hasSchemaMarker).toBe(true);
  });
});
