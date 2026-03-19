import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import type { Server } from 'socket.io';
import { errorHandler } from '../../middleware/errorHandler.js';
import { createTemplateRoutes } from '../templates.js';
import { getTemplates } from '../../utils/manifestTemplates.js';

const mockIo = {
  to: () => ({ emit: () => {} }),
  emit: () => {},
} as unknown as Server;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/', createTemplateRoutes({ io: mockIo }));
  app.use(errorHandler);
  return app;
}

let firstTemplateId: string;

beforeAll(() => {
  const templates = getTemplates();
  firstTemplateId = templates[0].id;
});

describe('GET /api/templates/manifest', () => {
  it('returns 200 with success envelope', async () => {
    const res = await request(buildApp()).get('/manifest');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns data as an array of templates', async () => {
    const res = await request(buildApp()).get('/manifest');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('each template has an id and name', async () => {
    const res = await request(buildApp()).get('/manifest');
    const first = res.body.data[0];
    expect(typeof first.id).toBe('string');
    expect(typeof first.name).toBe('string');
  });
});

describe('GET /api/templates/manifest/:id', () => {
  it('returns 200 with success envelope for a valid template id', async () => {
    const res = await request(buildApp()).get(`/manifest/${firstTemplateId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(firstTemplateId);
  });

  it('returns 404 with success:false for a nonexistent template id', async () => {
    const res = await request(buildApp()).get('/manifest/nonexistent-xyz');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.error).toBe('string');
  });
});
