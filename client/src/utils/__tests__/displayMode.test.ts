import { describe, it, expect } from 'vitest';
import { detectDisplayMode, getDisplayModeLabel } from '../displayMode';
import type { Presentation, GroupDefinition } from '@flideck/shared';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makePresentation(overrides: Partial<Presentation> = {}): Presentation {
  return {
    id: 'test-presentation',
    name: 'Test Presentation',
    path: '/tmp/test-presentation',
    assets: [],
    lastModified: Date.now(),
    ...overrides,
  };
}

function makeGroup(overrides: Partial<GroupDefinition> = {}): GroupDefinition {
  return {
    label: 'Group',
    order: 0,
    ...overrides,
  };
}

// ─── detectDisplayMode ───────────────────────────────────────────────────────

describe('detectDisplayMode', () => {
  it('returns flat for null presentation', () => {
    expect(detectDisplayMode(null)).toBe('flat');
  });

  it('returns flat for undefined presentation', () => {
    expect(detectDisplayMode(undefined)).toBe('flat');
  });

  it('returns flat when presentation has no groups and few assets', () => {
    const presentation = makePresentation({ assets: [{ id: 'a', name: 'A', filename: 'a.html', relativePath: 'a.html', isIndex: false, createdAt: 0, lastModified: 0 }] });
    expect(detectDisplayMode(presentation)).toBe('flat');
  });

  it('honours explicit displayMode from meta', () => {
    const presentation = makePresentation({
      meta: { displayMode: 'grouped' },
      assets: [],
    });
    expect(detectDisplayMode(presentation)).toBe('grouped');
  });

  it('honours explicit flat displayMode from meta even when groups exist', () => {
    const presentation = makePresentation({
      meta: { displayMode: 'flat' },
      groups: { g1: makeGroup({ label: 'G1', order: 0 }) },
      assets: Array.from({ length: 20 }, (_, i) => ({
        id: `s${i}`,
        name: `Slide ${i}`,
        filename: `slide-${i}.html`,
        relativePath: `slide-${i}.html`,
        isIndex: false,
        createdAt: 0,
        lastModified: 0,
      })),
    });
    expect(detectDisplayMode(presentation)).toBe('flat');
  });

  it('returns grouped when groups exist and slideCount > 15', () => {
    const assets = Array.from({ length: 16 }, (_, i) => ({
      id: `s${i}`,
      name: `Slide ${i}`,
      filename: `slide-${i}.html`,
      relativePath: `slide-${i}.html`,
      isIndex: false,
      createdAt: 0,
      lastModified: 0,
    }));
    const presentation = makePresentation({
      assets,
      groups: { g1: makeGroup({ label: 'G1', order: 0 }) },
    });
    expect(detectDisplayMode(presentation)).toBe('grouped');
  });

  it('returns flat when groups exist but slideCount <= 15 and no tab groups', () => {
    const assets = Array.from({ length: 10 }, (_, i) => ({
      id: `s${i}`,
      name: `Slide ${i}`,
      filename: `slide-${i}.html`,
      relativePath: `slide-${i}.html`,
      isIndex: false,
      createdAt: 0,
      lastModified: 0,
    }));
    const presentation = makePresentation({
      assets,
      groups: { g1: makeGroup({ label: 'G1', order: 0 }) },
    });
    expect(detectDisplayMode(presentation)).toBe('flat');
  });

  it('returns grouped when a group has tab:true (tab group) and groups exist', () => {
    const presentation = makePresentation({
      assets: [],
      groups: { g1: makeGroup({ label: 'G1', order: 0, tab: true }) },
    });
    expect(detectDisplayMode(presentation)).toBe('grouped');
  });

  it('returns grouped when slideCount > 50 and groups exist', () => {
    const assets = Array.from({ length: 51 }, (_, i) => ({
      id: `s${i}`,
      name: `Slide ${i}`,
      filename: `slide-${i}.html`,
      relativePath: `slide-${i}.html`,
      isIndex: false,
      createdAt: 0,
      lastModified: 0,
    }));
    const presentation = makePresentation({
      assets,
      groups: { g1: makeGroup({ label: 'G1', order: 0 }) },
    });
    expect(detectDisplayMode(presentation)).toBe('grouped');
  });

  it('returns flat when slideCount > 50 but no groups exist', () => {
    const assets = Array.from({ length: 51 }, (_, i) => ({
      id: `s${i}`,
      name: `Slide ${i}`,
      filename: `slide-${i}.html`,
      relativePath: `slide-${i}.html`,
      isIndex: false,
      createdAt: 0,
      lastModified: 0,
    }));
    const presentation = makePresentation({ assets });
    expect(detectDisplayMode(presentation)).toBe('flat');
  });

  it('returns grouped when container tabs exist and groups exist', () => {
    const presentation = makePresentation({
      assets: [],
      groups: { g1: makeGroup({ label: 'G1', order: 0 }) },
      tabs: [{ id: 'tab1', label: 'Tab 1', file: 'index-tab1.html', order: 0 }],
    });
    expect(detectDisplayMode(presentation)).toBe('grouped');
  });

  it('returns flat when container tabs exist but no groups exist', () => {
    const presentation = makePresentation({
      assets: [],
      tabs: [{ id: 'tab1', label: 'Tab 1', file: 'index-tab1.html', order: 0 }],
    });
    expect(detectDisplayMode(presentation)).toBe('flat');
  });
});

// ─── getDisplayModeLabel ─────────────────────────────────────────────────────

describe('getDisplayModeLabel', () => {
  it('returns a non-empty string for flat mode', () => {
    const label = getDisplayModeLabel('flat');
    expect(label).toBeTruthy();
    expect(typeof label).toBe('string');
  });

  it('returns a non-empty string for grouped mode', () => {
    const label = getDisplayModeLabel('grouped');
    expect(label).toBeTruthy();
    expect(typeof label).toBe('string');
  });

  it('returns "Flat List" for flat mode', () => {
    expect(getDisplayModeLabel('flat')).toBe('Flat List');
  });

  it('returns "Grouped" for grouped mode', () => {
    expect(getDisplayModeLabel('grouped')).toBe('Grouped');
  });
});
