import { describe, it, expect } from 'vitest';
import { createApiResponse, createErrorResponse } from '../responseHelper.js';

describe('createApiResponse', () => {
  it('wraps data in success envelope', () => {
    const result = createApiResponse({ id: 'deck-1', name: 'My Deck' });
    expect(result).toEqual({ success: true, data: { id: 'deck-1', name: 'My Deck' } });
  });

  it('accepts null as data', () => {
    const result = createApiResponse(null);
    expect(result).toEqual({ success: true, data: null });
  });

  it('includes _context when context is provided', () => {
    const context = { presentationsRoot: '/home/user/presentations' };
    const result = createApiResponse({ id: 'deck-1' }, context);
    expect(result).toEqual({
      success: true,
      data: { id: 'deck-1' },
      _context: { presentationsRoot: '/home/user/presentations' },
    });
  });

  it('accepts an array as data', () => {
    const result = createApiResponse([1, 2, 3]);
    expect(result.success).toBe(true);
    expect(result.data).toEqual([1, 2, 3]);
  });

  it('accepts an empty object as data', () => {
    const result = createApiResponse({});
    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });

  it('omits _context when no context is passed', () => {
    const result = createApiResponse({ id: 'deck-1' });
    expect(Object.prototype.hasOwnProperty.call(result, '_context')).toBe(false);
  });

  it('preserves all keys on object data', () => {
    const data = { id: 'deck-1', name: 'My Deck', assets: ['a.html', 'b.html'], count: 2 };
    const result = createApiResponse(data);
    expect(result.data).toEqual(data);
    expect(result.data).toHaveProperty('id', 'deck-1');
    expect(result.data).toHaveProperty('name', 'My Deck');
    expect(result.data).toHaveProperty('assets');
    expect(result.data).toHaveProperty('count', 2);
  });
});

describe('createErrorResponse', () => {
  it('returns a failure envelope with the error message', () => {
    const result = createErrorResponse('Presentation not found');
    expect(result).toEqual({ success: false, error: 'Presentation not found' });
  });

  it('uses the exact message string provided', () => {
    const msg = 'Something went wrong';
    const result = createErrorResponse(msg);
    expect(result.error).toBe(msg);
  });
});
