import { describe, it, expect } from 'vitest';
import { stripSlideWrapper } from '../stripSlideWrapper';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFullSlide(opts: {
  head?: string;
  body?: string;
  bodyAttrs?: string;
  htmlAttrs?: string;
} = {}): string {
  const { head = '', body = '', bodyAttrs = '', htmlAttrs = '' } = opts;
  return `<!DOCTYPE html>
<html ${htmlAttrs}>
<head>
  <meta charset="UTF-8">
  <title>Test Slide</title>
  ${head}
</head>
<body ${bodyAttrs}>
  ${body}
</body>
</html>`;
}

// ─── stripSlideWrapper ────────────────────────────────────────────────────────

describe('stripSlideWrapper', () => {
  // 1. Strips <html>/<head>/<body> wrapper
  it('strips <html>, <head>, and <body> wrapper tags from result body', () => {
    const result = stripSlideWrapper(makeFullSlide({ body: '<div>Hello</div>' }));
    expect(result.body).not.toMatch(/<html/i);
    expect(result.body).not.toMatch(/<head/i);
    expect(result.body).not.toMatch(/<body/i);
  });

  // 2. Preserves body content verbatim
  it('preserves body content — a div inside body appears in result', () => {
    const result = stripSlideWrapper(makeFullSlide({ body: '<div class="slide-content">My slide</div>' }));
    expect(result.body).toContain('<div class="slide-content">My slide</div>');
  });

  // 3. Collects <style> blocks from <head>
  it('collects <style> blocks from <head> into styles string', () => {
    const result = stripSlideWrapper(makeFullSlide({
      head: '<style>.title { color: red; }</style>',
    }));
    expect(result.styles).toContain('.title { color: red; }');
  });

  // 4. Collects <style> blocks from <body>
  it('collects <style> blocks from <body> into styles string', () => {
    const result = stripSlideWrapper(makeFullSlide({
      body: '<style>.body-style { font-size: 2rem; }</style><p>content</p>',
    }));
    expect(result.styles).toContain('.body-style { font-size: 2rem; }');
  });

  // 5. viewportLock: false for clean slide
  it('returns viewportLock: false for a clean slide with no viewport constraints', () => {
    const result = stripSlideWrapper(makeFullSlide({
      head: '<style>body { margin: 0; font-family: sans-serif; }</style>',
      body: '<h1>Clean slide</h1>',
    }));
    expect(result.viewportLock).toBe(false);
  });

  // 6. viewportLock: true for scroll-snap-type in CSS
  it('returns viewportLock: true when scroll-snap-type is present in a <style> block', () => {
    const result = stripSlideWrapper(makeFullSlide({
      head: '<style>html { scroll-snap-type: y mandatory; }</style>',
      body: '<section>Slide 1</section>',
    }));
    expect(result.viewportLock).toBe(true);
  });

  // 7. viewportLock: true for overflow: hidden on body inline style
  it('returns viewportLock: true when body has overflow: hidden in inline style attribute', () => {
    const result = stripSlideWrapper(makeFullSlide({
      bodyAttrs: 'style="overflow: hidden;"',
      body: '<div>Content</div>',
    }));
    expect(result.viewportLock).toBe(true);
  });

  // 8. viewportLock: true for height: 100vh in a <style> block
  it('returns viewportLock: true when a <style> block contains height: 100vh', () => {
    const result = stripSlideWrapper(makeFullSlide({
      head: '<style>section { height: 100vh; display: flex; }</style>',
      body: '<section>Full viewport section</section>',
    }));
    expect(result.viewportLock).toBe(true);
  });

  // 8b. viewportLock: true for height: 95vh
  it('returns viewportLock: true when a <style> block contains height: 95vh', () => {
    const result = stripSlideWrapper(makeFullSlide({
      head: '<style>.card { height: 95vh; }</style>',
    }));
    expect(result.viewportLock).toBe(true);
  });

  // 9. viewportLock: false for a harness fragment (already stripped)
  it('returns viewportLock: false for a harness fragment with no wrapper and no viewport patterns', () => {
    const fragment = `<!-- harness-fragment: type-a -->
<style>.slide-content { font-family: sans-serif; }</style>
<div class="slide-content"><h1>Already stripped</h1></div>`;
    const result = stripSlideWrapper(fragment);
    expect(result.viewportLock).toBe(false);
  });

  // 10. Handles empty body gracefully
  it('handles an empty body gracefully — returns empty string for body, no crash', () => {
    const result = stripSlideWrapper(makeFullSlide({ body: '' }));
    expect(result.body.trim()).toBe('');
    expect(result.styles).toBe('');
    expect(result.scripts).toEqual([]);
    expect(result.viewportLock).toBe(false);
  });

  // 11. Collects multiple <style> blocks and concatenates them
  it('concatenates multiple <style> blocks from head and body into one styles string', () => {
    const result = stripSlideWrapper(makeFullSlide({
      head: '<style>.a { color: blue; }</style><style>.b { color: green; }</style>',
      body: '<style>.c { color: red; }</style><p>Hi</p>',
    }));
    expect(result.styles).toContain('.a { color: blue; }');
    expect(result.styles).toContain('.b { color: green; }');
    expect(result.styles).toContain('.c { color: red; }');
  });

  // 12. Collects inline scripts
  it('collects inline <script> text content into scripts array', () => {
    const result = stripSlideWrapper(makeFullSlide({
      body: '<script>console.log("hello");</script><p>Content</p>',
    }));
    expect(result.scripts).toHaveLength(1);
    expect(result.scripts[0]).toContain('console.log("hello");');
  });

  // 13. Skips external scripts (src="...")
  it('skips external <script src="..."> tags — not included in scripts array', () => {
    const result = stripSlideWrapper(makeFullSlide({
      head: '<script src="https://example.com/lib.js"></script>',
      body: '<p>Hello</p>',
    }));
    expect(result.scripts).toHaveLength(0);
  });

  // 14. Skips type="module" scripts
  it('skips <script type="module"> tags — not included in scripts array', () => {
    const result = stripSlideWrapper(makeFullSlide({
      body: '<script type="module">import foo from "./foo.js";</script><p>Hi</p>',
    }));
    expect(result.scripts).toHaveLength(0);
  });

  // 15. viewportLock: true for overflow:hidden in a <style> block (not just inline)
  it('returns viewportLock: true when overflow: hidden is in a <style> block', () => {
    const result = stripSlideWrapper(makeFullSlide({
      head: '<style>body { overflow: hidden; margin: 0; }</style>',
    }));
    expect(result.viewportLock).toBe(true);
  });

  // 16. Returns correct StrippedSlide shape
  it('returns an object with styles (string), body (string), scripts (array), viewportLock (boolean)', () => {
    const result = stripSlideWrapper(makeFullSlide({ body: '<p>hi</p>' }));
    expect(typeof result.styles).toBe('string');
    expect(typeof result.body).toBe('string');
    expect(Array.isArray(result.scripts)).toBe(true);
    expect(typeof result.viewportLock).toBe('boolean');
  });

  // 17. Google Fonts <link> tags are not included in output
  it('does not include Google Fonts <link> tag content in styles or body', () => {
    const result = stripSlideWrapper(makeFullSlide({
      head: '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto">',
      body: '<p>Slide with Google Font</p>',
    }));
    expect(result.styles).not.toContain('fonts.googleapis.com');
    expect(result.body).not.toContain('fonts.googleapis.com');
  });
});
