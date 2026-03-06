import { describe, it, expect } from 'vitest';
import {
  getTemplates,
  getTemplateById,
  applyTemplate,
} from '../../utils/manifestTemplates.js';
import { queryString } from '../../utils/queryString.js';
import { validate, validateOrThrow, getSchema } from '../../utils/manifestValidator.js';
import type { FlideckManifest, ManifestTemplate } from '@flideck/shared';

// ============================================================
// manifestTemplates.ts
// ============================================================

describe('manifestTemplates', () => {
  describe('getTemplates', () => {
    it('returns a non-empty array of templates', () => {
      const templates = getTemplates();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
    });

    it('every template has required fields: id, name, description, structure', () => {
      const templates = getTemplates();
      for (const t of templates) {
        expect(typeof t.id).toBe('string');
        expect(t.id.length).toBeGreaterThan(0);
        expect(typeof t.name).toBe('string');
        expect(typeof t.description).toBe('string');
        expect(t.structure).toBeDefined();
      }
    });

    it('includes the built-in "simple" and "tutorial" templates', () => {
      const ids = getTemplates().map((t) => t.id);
      expect(ids).toContain('simple');
      expect(ids).toContain('tutorial');
    });
  });

  describe('getTemplateById', () => {
    it('returns the correct template for a known id', () => {
      const t = getTemplateById('simple');
      expect(t).toBeDefined();
      expect(t!.id).toBe('simple');
    });

    it('returns undefined for an unknown id', () => {
      expect(getTemplateById('does-not-exist')).toBeUndefined();
    });

    it('returns persona-tabs template with tab:true groups', () => {
      const t = getTemplateById('persona-tabs');
      expect(t).toBeDefined();
      const groups = t!.structure.groups ?? {};
      const groupEntries = Object.values(groups);
      expect(groupEntries.length).toBeGreaterThan(0);
      expect(groupEntries.every((g) => g.tab === true)).toBe(true);
    });
  });

  describe('applyTemplate', () => {
    const simpleTemplate = getTemplateById('simple') as ManifestTemplate;
    const tutorialTemplate = getTemplateById('tutorial') as ManifestTemplate;

    it('replace mode: returns template structure preserving existing slides', () => {
      const existingManifest: FlideckManifest = {
        slides: [{ file: 'existing.html', title: 'Existing' }],
        meta: { name: 'Old Name' },
      };
      const result = applyTemplate(existingManifest, simpleTemplate, false);
      // Template structure applied
      expect(result.meta?.displayMode).toBe('flat');
      // Existing slides preserved
      expect(result.slides).toHaveLength(1);
      expect(result.slides![0].file).toBe('existing.html');
    });

    it('replace mode with null manifest: produces empty slides array', () => {
      const result = applyTemplate(null, simpleTemplate, false);
      expect(Array.isArray(result.slides)).toBe(true);
      expect(result.slides).toHaveLength(0);
    });

    it('merge mode: template groups do not overwrite existing groups with same key', () => {
      const existingManifest: FlideckManifest = {
        meta: { displayMode: 'flat' },
        groups: {
          intro: { label: 'My Custom Intro', order: 99 },
        },
        slides: [],
      };
      const result = applyTemplate(existingManifest, tutorialTemplate, true);
      // Existing intro group wins over template intro group
      expect(result.groups!['intro'].label).toBe('My Custom Intro');
      expect(result.groups!['intro'].order).toBe(99);
      // Template groups that don't conflict are added
      expect(result.groups!['basics']).toBeDefined();
    });

    it('merge mode: existing meta fields override template meta fields', () => {
      const existingManifest: FlideckManifest = {
        meta: { displayMode: 'flat', name: 'My Deck' },
        slides: [{ file: 'a.html' }],
      };
      const result = applyTemplate(existingManifest, tutorialTemplate, true);
      // Existing displayMode wins
      expect(result.meta?.displayMode).toBe('flat');
      // Existing name is preserved
      expect(result.meta?.name).toBe('My Deck');
    });

    it('merge mode: slides from existing manifest are preserved unchanged', () => {
      const existingManifest: FlideckManifest = {
        slides: [
          { file: 'slide1.html', group: 'intro' },
          { file: 'slide2.html', group: 'basics' },
        ],
      };
      const result = applyTemplate(existingManifest, tutorialTemplate, true);
      expect(result.slides).toHaveLength(2);
      expect(result.slides![0].file).toBe('slide1.html');
    });
  });
});

// ============================================================
// queryString.ts
// ============================================================

describe('queryString', () => {
  it('returns the string value when given a plain string', () => {
    expect(queryString('hello')).toBe('hello');
  });

  it('returns defaultValue when given undefined', () => {
    expect(queryString(undefined)).toBe('');
    expect(queryString(undefined, 'fallback')).toBe('fallback');
  });

  it('returns defaultValue when given null', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(queryString(null as any, 'nope')).toBe('nope');
  });

  it('returns the first string element of an array', () => {
    expect(queryString(['first', 'second'])).toBe('first');
  });

  it('returns defaultValue when array first element is not a string', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(queryString([{ key: 'val' } as any], 'default')).toBe('default');
  });

  it('returns defaultValue when given a plain object (ParsedQs)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(queryString({ nested: 'val' } as any, 'fallback')).toBe('fallback');
  });
});

// ============================================================
// manifestValidator.ts
// ============================================================

describe('manifestValidator', () => {
  describe('getSchema', () => {
    it('returns an object with a $schema property', () => {
      const schema = getSchema();
      expect(schema).toBeDefined();
      expect(typeof schema.$schema).toBe('string');
    });
  });

  describe('validate', () => {
    it('accepts a valid minimal manifest (empty object)', () => {
      const result = validate({});
      expect(result.valid).toBe(true);
    });

    it('accepts a manifest with meta and slides', () => {
      const manifest: FlideckManifest = {
        meta: { name: 'My Deck', displayMode: 'flat' },
        slides: [{ file: 'intro.html', title: 'Intro' }],
      };
      const result = validate(manifest);
      expect(result.valid).toBe(true);
    });

    it('rejects a manifest with an invalid displayMode value', () => {
      const manifest = {
        meta: { displayMode: 'invalid-mode' },
      };
      const result = validate(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('returns errors array on invalid manifest', () => {
      const result = validate({ meta: { displayMode: 'bad' } });
      expect(result.valid).toBe(false);
      expect(Array.isArray(result.errors)).toBe(true);
      // Each error has field and message
      for (const err of result.errors!) {
        expect(typeof err.field).toBe('string');
        expect(typeof err.message).toBe('string');
      }
    });
  });

  describe('validateOrThrow', () => {
    it('does not throw for a valid manifest', () => {
      expect(() => validateOrThrow({ slides: [] })).not.toThrow();
    });

    it('throws for an invalid manifest', () => {
      expect(() =>
        validateOrThrow({ meta: { displayMode: 'totally-wrong' } })
      ).toThrow(/Manifest validation failed/);
    });
  });
});
