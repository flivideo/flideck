import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import { errorHandler } from '../../middleware/errorHandler.js';
import { createQueryRoutes } from '../query.js';
import { PresentationService } from '../../services/PresentationService.js';

let tmpRoot: string;
let app: express.Express;

beforeAll(async () => {
  tmpRoot = path.join(os.tmpdir(), `flideck-query-test-${Date.now()}`);
  await fs.ensureDir(tmpRoot);

  // Create a minimal presentation
  const presentationDir = path.join(tmpRoot, 'test-deck');
  await fs.ensureDir(presentationDir);
  await fs.writeFile(path.join(presentationDir, 'index.html'), '<html><body>test</body></html>');

  const service = PresentationService.getInstance();
  service.setRoot(tmpRoot);

  app = express();
  app.use(express.json());
  app.use('/', createQueryRoutes());
  app.use(errorHandler);
});

describe('GET /routes', () => {
  it('returns 200 with success:true, data.routes as array and data.currentRoute as string', async () => {
    const res = await request(app).get('/routes');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.routes)).toBe(true);
    expect(typeof res.body.data.currentRoute).toBe('string');
  });

  it('includes the tmpRoot basename as currentRoute', async () => {
    const res = await request(app).get('/routes');
    expect(res.status).toBe(200);
    expect(res.body.data.currentRoute).toBe(path.basename(tmpRoot));
  });
});

describe('GET /routes/:route', () => {
  it('returns 200 with success:true and data.presentations as array for valid route', async () => {
    const routeName = path.basename(tmpRoot);
    const res = await request(app).get(`/routes/${routeName}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.presentations)).toBe(true);
  });

  it('returns 404 with success:false for nonexistent route', async () => {
    const res = await request(app).get('/routes/nonexistent-route-xyz');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.error).toBe('string');
  });
});

describe('GET /presentations/:id', () => {
  it('returns 200 with success:true and data.totalAssets as number for valid id', async () => {
    const res = await request(app).get('/presentations/test-deck');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.totalAssets).toBe('number');
  });

  it('returns 404 with success:false for nonexistent presentation id', async () => {
    const res = await request(app).get('/presentations/nonexistent-id-xyz');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.error).toBe('string');
  });
});
