import express from 'express';
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import type { Server } from 'socket.io';
import { errorHandler } from '../../middleware/errorHandler.js';
import { createConfigRoutes } from '../config.js';

const mockIo = {
  to: () => ({ emit: () => {} }),
  emit: () => {},
} as unknown as Server;

const mockWatcherManager = { watch: () => {}, unwatch: () => {}, stop: () => {} } as any;

const mockOnChange = () => {};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(
    '/',
    createConfigRoutes({
      io: mockIo,
      watcherManager: mockWatcherManager,
      onPresentationChange: mockOnChange,
    })
  );
  app.use(errorHandler);
  return app;
}

describe('GET /api/config', () => {
  it('returns 200 with success envelope and presentationsRoot', async () => {
    const res = await request(buildApp()).get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(typeof res.body.data.presentationsRoot).toBe('string');
  });

  it('does not double-wrap the response (data should not have a nested success key)', async () => {
    const res = await request(buildApp()).get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // data itself should not carry a success key — that would indicate double-wrapping
    expect(res.body.data.success).toBeUndefined();
  });
});
