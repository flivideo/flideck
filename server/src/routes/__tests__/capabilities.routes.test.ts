import express from 'express';
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { errorHandler } from '../../middleware/errorHandler.js';
import { createCapabilitiesRoutes } from '../capabilities.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/', createCapabilitiesRoutes());
  app.use(errorHandler);
  return app;
}

describe('GET /api/capabilities', () => {
  it('returns 200 with success envelope', async () => {
    const res = await request(buildApp()).get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns data.name as FliDeck Presentation Server', async () => {
    const res = await request(buildApp()).get('/');
    expect(res.body.data.name).toBe('FliDeck Presentation Server');
  });

  it('returns data.api_summary as an object', async () => {
    const res = await request(buildApp()).get('/');
    expect(res.body.data.api_summary).toBeDefined();
    expect(typeof res.body.data.api_summary).toBe('object');
    expect(Array.isArray(res.body.data.api_summary)).toBe(false);
  });

  it('returns data.tips as an array', async () => {
    const res = await request(buildApp()).get('/');
    expect(Array.isArray(res.body.data.tips)).toBe(true);
    expect(res.body.data.tips.length).toBeGreaterThan(0);
  });
});
