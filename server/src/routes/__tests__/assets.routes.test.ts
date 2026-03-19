import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import { errorHandler } from '../../middleware/errorHandler.js';
import { createAssetRoutes } from '../assets.js';
import { PresentationService } from '../../services/PresentationService.js';

let tmpRoot: string;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/', createAssetRoutes());
  app.use(errorHandler);
  return app;
}

beforeAll(async () => {
  tmpRoot = path.join(os.tmpdir(), `flideck-assets-test-${Date.now()}`);
  await fs.ensureDir(tmpRoot);

  // Create a minimal presentation folder with an index.html
  const presentationDir = path.join(tmpRoot, 'test-deck');
  await fs.ensureDir(presentationDir);
  await fs.writeFile(
    path.join(presentationDir, 'index.html'),
    '<html><body>test presentation</body></html>'
  );

  const service = PresentationService.getInstance();
  service.setRoot(tmpRoot);

  // Invalidate the cache so the new root is picked up
  service.invalidateCache();
});

afterAll(() => {
  PresentationService.getInstance().setRoot('');
});

describe('GET /:presentationId/:assetId', () => {
  it('returns 200 with asset content for a real file', async () => {
    // Asset IDs are the filename without extension (e.g. "index" for "index.html")
    const res = await request(buildApp()).get('/test-deck/index');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(typeof res.body.data.content).toBe('string');
  });

  it('returns 404 for a nonexistent presentation', async () => {
    const res = await request(buildApp()).get('/nonexistent-deck/nonexistent.html');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.error).toBe('string');
  });
});
