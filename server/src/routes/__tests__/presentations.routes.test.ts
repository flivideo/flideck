import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'socket.io';
import { errorHandler } from '../../middleware/errorHandler.js';
import { createPresentationRoutes } from '../presentations.js';
import { PresentationService } from '../../services/PresentationService.js';

const mockIo = {
  to: () => ({ emit: () => {} }),
  emit: () => {},
  in: () => ({ emit: () => {} }),
} as unknown as Server;

let tmpRoot: string;
let app: express.Express;

beforeAll(async () => {
  tmpRoot = path.join(os.tmpdir(), `flideck-pres-test-${Date.now()}`);
  await fs.ensureDir(tmpRoot);

  // Create a minimal presentation
  const presentationDir = path.join(tmpRoot, 'test-deck');
  await fs.ensureDir(presentationDir);
  await fs.writeFile(path.join(presentationDir, 'index.html'), '<html><body>test</body></html>');

  PresentationService.getInstance().setRoot(tmpRoot);

  app = express();
  app.use(express.json());
  app.use('/', createPresentationRoutes({ io: mockIo }));
  app.use(errorHandler);
});

afterAll(() => {
  PresentationService.getInstance().setRoot('');
});

describe('presentations routes', () => {
  // Test 1: GET / returns 200, success:true, data is array, _context.presentationsRoot is a string
  it('GET / returns 200 with envelope containing data array and _context.presentationsRoot', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body._context).toBe('object');
    expect(typeof res.body._context.presentationsRoot).toBe('string');
  });

  // Test 2: GET / data array items have id and name fields
  it('GET / data array items have id and name fields', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    const items: Array<{ id: string; name: string }> = res.body.data;
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(typeof item.id).toBe('string');
      expect(typeof item.name).toBe('string');
    }
  });

  // Test 3: GET /test-deck → 200, success:true, data.id === 'test-deck', _context exists
  it('GET /:id returns single presentation with correct id and _context', async () => {
    const res = await request(app).get('/test-deck');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('test-deck');
    expect(res.body._context).toBeDefined();
    expect(typeof res.body._context.presentationsRoot).toBe('string');
  });

  // Test 4: GET /nonexistent-presentation-xyz → 404, success:false, error is a string
  it('GET /:id returns 404 with error envelope for nonexistent presentation', async () => {
    const res = await request(app).get('/nonexistent-presentation-xyz');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.error).toBe('string');
  });

  // Test 5: GET /test-deck/manifest → 200 or 404, success:true, _context.presentationsRoot exists
  it('GET /:id/manifest returns success envelope with _context.presentationsRoot', async () => {
    const res = await request(app).get('/test-deck/manifest');
    // Manifest may be null if no index.json exists, but response should still be 200 success
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body._context).toBeDefined();
    expect(typeof res.body._context.presentationsRoot).toBe('string');
  });

  // Test 6: POST /refresh → 200, success:true, data is an array
  it('POST /refresh returns 200 with success envelope containing data array', async () => {
    const res = await request(app).post('/refresh');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // Test 7: GET / _context has no extra unexpected fields (only presentationsRoot)
  it('GET / _context contains only presentationsRoot field', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    const contextKeys = Object.keys(res.body._context);
    expect(contextKeys).toEqual(['presentationsRoot']);
  });

  // Test 8: POST /test-deck/slides with a valid body returns success:true envelope
  it('POST /:id/slides with valid body returns success:true envelope', async () => {
    // Create the HTML file so the service can reference it (or accept missing)
    const slideFile = path.join(tmpRoot, 'test-deck', 'slide-01.html');
    await fs.writeFile(slideFile, '<html><body>slide 01</body></html>');

    const res = await request(app)
      .post('/test-deck/slides')
      .send({ file: 'slide-01.html', title: 'Slide 01' });

    // Should be 201 success or 409 if already exists — either way the envelope is success:true
    expect([201, 409]).toContain(res.status);
    expect(res.body.success).toBe(true);
  });

  // Additional test 9: POST /nonexistent-presentation-xyz/slides → 404, success:false
  it('POST /:id/slides on nonexistent presentation returns 404', async () => {
    const res = await request(app)
      .post('/nonexistent-presentation-xyz/slides')
      .send({ file: 'slide.html' });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.error).toBe('string');
  });

  // Additional test 10: POST /test-deck/slides with missing file field → 400, success:false
  it('POST /:id/slides with missing file field returns 400 error envelope', async () => {
    const res = await request(app)
      .post('/test-deck/slides')
      .send({ title: 'No file field' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.error).toBe('string');
  });
});
