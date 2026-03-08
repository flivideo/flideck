/**
 * FliDeck Visual Verification Pipeline
 *
 * Compares iframe rendering (main branch, port 5201 static server) vs harness rendering
 * (worktree, port 5203 static server) for each slide in a presentation (or all presentations).
 *
 * KEY ARCHITECTURE NOTES:
 * - Slides are screenshotted directly from the server's static file serving endpoint,
 *   NOT through the React app. This is because the React client (/presentation/:id) uses
 *   React state for asset selection — there is no URL query param to navigate to a specific
 *   slide. The static files are the actual slide HTML, which is exactly what both the iframe
 *   and harness render.
 * - Main branch static files:   http://localhost:5201/presentations/:id/:filename
 * - Worktree static files:      http://localhost:5203/presentations/:id/:filename
 * - Presentations list API:     GET http://localhost:5201/api/presentations
 *   Response shape: { success: true, data: Presentation[], _context: { presentationsRoot } }
 * - Single presentation API:    GET http://localhost:5201/api/presentations/:id
 *   Response shape: { success: true, data: Presentation, _context: { presentationsRoot } }
 * - Asset fields: { id (filename without ext), filename, name, isIndex, group, ... }
 *
 * Usage:
 *   node pipeline.js                                    # all presentations
 *   node pipeline.js --presentation color-exploration   # single presentation by id
 *
 * Output:
 *   playwright/output/report.md      - pass/fail summary table
 *   playwright/output/pass/          - side-by-side passing pairs (left=main, center=worktree, right=diff)
 *   playwright/output/flagged/       - failing or manual-review slides
 */

'use strict';

const { chromium } = require('playwright');
const pixelmatch = require('pixelmatch');
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Static file servers (server process ports)
// Slides are served directly at: /presentations/:presentationId/:filename
const MAIN_STATIC   = 'http://localhost:5201';
const HARNESS_STATIC = 'http://localhost:5203';

// API servers (same ports — the server serves both API and static files)
const MAIN_API    = 'http://localhost:5201';
const HARNESS_API = 'http://localhost:5203';

// Harness shell page — wraps stripped v2 fragments in a full HTML document with
// fonts + CSS tokens loaded. Served by the harness static server (port 5203).
// Usage: HARNESS_SHELL_URL + '?src=' + encodeURIComponent('/presentations/:id/:file')
const HARNESS_SHELL_URL = 'http://localhost:5203/harness-shell.html';

const VIEWPORT = { width: 1280, height: 800 };

// Fraction of total pixels that may differ before a slide is flagged (1% default)
const DIFF_THRESHOLD = 0.01;

const OUTPUT_DIR = path.join(__dirname, 'output');

// Asset IDs (filename without extension) that cannot be pixel-diffed because they
// contain dynamic content (live API calls, timestamps, random data, etc.).
// These are moved to the flagged/ folder with status "manual-review".
const MANUAL_REVIEW_PATTERNS = [
  'story-2-5-sat-cheatsheet',
  'story-2-6-sat-cheatsheet',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch JSON from a URL and return the parsed body.
 * Throws a descriptive error if the fetch fails or returns non-OK status.
 */
async function fetchJson(url) {
  let resp;
  try {
    resp = await fetch(url);
  } catch (err) {
    throw new Error(`Network error fetching ${url}: ${err.message}`);
  }
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} fetching ${url}`);
  }
  return resp.json();
}

/**
 * Build the direct static URL for a slide HTML file on either server.
 * Pattern: http://localhost:{port}/presentations/{presentationId}/{filename}
 */
function slideUrl(staticBase, presentationId, filename) {
  return `${staticBase}/presentations/${presentationId}/${encodeURIComponent(filename)}`;
}

// Harness CSS tokens — same 10 vars defined in harness.css / harness-shell.html.
// Injected into original standalone slides before screenshotting so that both
// sides of the diff have the same token context. Slides that define their own
// :root values will override these (correct behaviour — same as harness).
const HARNESS_TOKEN_CSS = `
  :root {
    --brand-brown:    #342d2d;
    --brand-gold:     #ccba9d;
    --brand-yellow:   #ffde59;
    --white:          #ffffff;
    --brand-gray:     #595959;
    --doc-blue:       #3b82f6;
    --runtime-purple: #8b5cf6;
    --success-green:  #22c55e;
    --issue-amber:    #f59e0b;
    --pain-red:       #ef4444;
  }
`;

/**
 * Screenshot a URL in Playwright and return the PNG buffer.
 * Waits for networkidle so fonts/images are loaded before capture.
 */
async function screenshot(browser, url) {
  const page = await browser.newPage();
  try {
    await page.setViewportSize(VIEWPORT);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    const buf = await page.screenshot({ fullPage: false });
    return buf;
  } finally {
    await page.close();
  }
}

/**
 * Screenshot a URL with harness CSS tokens injected — for original standalone
 * slides that may reference tokens defined by the harness but not their own :root.
 * This makes the comparison fair: original-with-tokens vs v2-in-harness-with-tokens.
 */
async function screenshotWithTokens(browser, url) {
  const page = await browser.newPage();
  try {
    await page.setViewportSize(VIEWPORT);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.addStyleTag({ content: HARNESS_TOKEN_CSS });
    const buf = await page.screenshot({ fullPage: false });
    return buf;
  } finally {
    await page.close();
  }
}

/**
 * Pixel-diff two PNG buffers.
 * Returns { numDiff, diffPercent, diffPng }.
 */
function pixelDiff(bufA, bufB) {
  const imgA = PNG.sync.read(bufA);
  const imgB = PNG.sync.read(bufB);

  // If dimensions differ, diff is 100%
  if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
    return { numDiff: -1, diffPercent: 1.0, diffPng: null };
  }

  const { width, height } = imgA;
  const diff = new PNG({ width, height });

  const numDiff = pixelmatch(imgA.data, imgB.data, diff.data, width, height, {
    threshold: 0.1, // per-pixel sensitivity (not the same as DIFF_THRESHOLD)
  });

  const diffPercent = numDiff / (width * height);
  return { numDiff, diffPercent, diffPng: diff };
}

/**
 * Combine three PNGs side-by-side (left | center | right) and write to disk.
 * If diffPng is null (dimension mismatch), the right panel is blank/black.
 */
function saveSideBySide(leftBuf, rightBuf, diffPng, outputPath) {
  const left  = PNG.sync.read(leftBuf);
  const right = PNG.sync.read(rightBuf);
  const w = left.width;
  const h = left.height;

  const panelWidth = Math.max(left.width, right.width);
  const combined = new PNG({ width: panelWidth * 3, height: h });

  // Fill with black
  combined.data.fill(0);

  PNG.bitblt(left,  combined, 0, 0, left.width,  h, 0,           0);
  PNG.bitblt(right, combined, 0, 0, right.width, h, panelWidth,   0);
  if (diffPng) {
    PNG.bitblt(diffPng, combined, 0, 0, w, h, panelWidth * 2, 0);
  }

  fs.writeFileSync(outputPath, PNG.sync.write(combined));
}

/**
 * Sanitise a string for use in a filename.
 */
function toFilenameSegment(str) {
  return str.replace(/[^a-zA-Z0-9_-]/g, '_');
}

// ---------------------------------------------------------------------------
// Quality rating
// ---------------------------------------------------------------------------

/**
 * Assign a quality label based on pixel diff percentage.
 *
 * perfect   < 0.1%  — noise floor, essentially pixel-identical
 * excellent 0.1–0.5% — typical font anti-aliasing variation
 * good      0.5–1.0% — within threshold, minor variation
 * review    1.0–3.0% — above threshold, human check needed
 * fail      > 3.0%  — real visual difference
 */
function getQuality(diffPercent) {
  if (diffPercent == null)  return 'n/a';
  if (diffPercent < 0.001)  return 'perfect';
  if (diffPercent < 0.005)  return 'excellent';
  if (diffPercent < 0.010)  return 'good';
  if (diffPercent < 0.030)  return 'review';
  return 'fail';
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function writeReport(results) {
  // Attach quality to each result
  const enriched = results.map(r => ({
    ...r,
    diffPct: r.diffPercent != null ? parseFloat((r.diffPercent * 100).toFixed(4)) : null,
    quality: r.status === 'pass' || r.status === 'fail'
      ? getQuality(r.diffPercent)
      : r.status,
  }));

  const pass   = enriched.filter(r => r.status === 'pass');
  const fail   = enriched.filter(r => r.status === 'fail');
  const manual = enriched.filter(r => r.status === 'manual-review');
  const errors = enriched.filter(r => r.status === 'error');

  const now = new Date().toISOString();

  // --- JSON results ---
  const json = {
    generatedAt: now,
    summary: {
      total: enriched.length,
      pass: pass.length,
      fail: fail.length,
      manual: manual.length,
      error: errors.length,
      qualityCounts: ['perfect', 'excellent', 'good', 'review', 'fail', 'n/a'].reduce((acc, q) => {
        acc[q] = enriched.filter(r => r.quality === q).length;
        return acc;
      }, {}),
    },
    threshold: { diffPercent: DIFF_THRESHOLD * 100, description: 'slides above this % are flagged' },
    qualityScale: {
      perfect:   '< 0.1% — noise floor, pixel-identical',
      excellent: '0.1–0.5% — font anti-aliasing noise',
      good:      '0.5–1.0% — within threshold, minor variation',
      review:    '1.0–3.0% — above threshold, human check needed',
      fail:      '> 3.0% — real visual difference',
    },
    results: enriched.map(r => ({
      presentation: r.presentation,
      slide:        r.slide,
      status:       r.status,
      diffPct:      r.diffPct,
      quality:      r.quality,
      error:        r.error || null,
    })),
  };

  const jsonPath = path.join(OUTPUT_DIR, 'results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2) + '\n');

  // --- Markdown report ---
  const lines = [
    '# FliDeck Visual Verification Report',
    '',
    `**Generated**: ${now}`,
    `**Total**: ${enriched.length}  |  Pass: ${pass.length}  |  Fail: ${fail.length}  |  Manual: ${manual.length}  |  Error: ${errors.length}`,
    '',
    '## Quality Breakdown',
    '',
    '| Quality | Count | Diff range |',
    '|---|---|---|',
    `| perfect   | ${json.summary.qualityCounts.perfect}   | < 0.1%      |`,
    `| excellent | ${json.summary.qualityCounts.excellent} | 0.1 – 0.5%  |`,
    `| good      | ${json.summary.qualityCounts.good}      | 0.5 – 1.0%  |`,
    `| review    | ${json.summary.qualityCounts.review}    | 1.0 – 3.0%  |`,
    `| fail      | ${json.summary.qualityCounts.fail}      | > 3.0%      |`,
    '',
    '## Results',
    '',
    '| Presentation | Slide | Status | Quality | Diff % | Notes |',
    '|---|---|---|---|---|---|',
    ...enriched.map(r => {
      const diffStr = r.diffPct != null ? r.diffPct.toFixed(2) + '%' : '—';
      const notes   = r.error ? r.error.slice(0, 80) : '';
      return `| ${r.presentation} | ${r.slide} | ${r.status} | ${r.quality} | ${diffStr} | ${notes} |`;
    }),
  ];

  const reportPath = path.join(OUTPUT_DIR, 'report.md');
  fs.writeFileSync(reportPath, lines.join('\n') + '\n');

  console.log(`\nReport:  ${reportPath}`);
  console.log(`JSON:    ${jsonPath}`);
  console.log(`Pass: ${pass.length}  |  Fail: ${fail.length}  |  Manual: ${manual.length}  |  Error: ${errors.length}`);
  if (pass.length > 0) {
    console.log(`Quality: perfect=${json.summary.qualityCounts.perfect} excellent=${json.summary.qualityCounts.excellent} good=${json.summary.qualityCounts.good}`);
  }

  return { pass, fail, manual, errors };
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// PoC: harness-shell URL builder for v2 fragments
// ---------------------------------------------------------------------------

/**
 * Return true if a presentation ID refers to a v2 fragment folder.
 * Convention: v2 folders end with "-v2".
 */
function isV2Presentation(id) {
  return id.endsWith('-v2');
}

/**
 * Build the URL to use when screenshotting a harness slide.
 * - v2 presentations: route through harness-shell.html so stripped fragments
 *   get fonts + CSS tokens injected before render.
 * - non-v2 presentations: direct static URL (full HTML, no wrapper needed).
 */
function harnessSlideUrl(presentationId, filename) {
  if (isV2Presentation(presentationId)) {
    const fragmentSrc = `/presentations/${presentationId}/${encodeURIComponent(filename)}`;
    return `${HARNESS_SHELL_URL}?src=${encodeURIComponent(fragmentSrc)}`;
  }
  return slideUrl(HARNESS_STATIC, presentationId, filename);
}


// ---------------------------------------------------------------------------
// PoC run: compare color-exploration (original) vs color-exploration-v2
// ---------------------------------------------------------------------------

/**
 * Fetch the HTML file list for a presentation folder directly from the static
 * server (no API call needed for PoC — we just list files via the API).
 * Returns an array of filename strings.
 */
async function fetchAssetsForPresentation(apiBase, presentationId) {
  const body = await fetchJson(`${apiBase}/api/presentations/${presentationId}`);
  const assets = (body.data && body.data.assets) ? body.data.assets : [];
  return assets;
}

/**
 * PoC pipeline: screenshots color-exploration from main (port 5201) and
 * color-exploration-v2 from harness-shell (port 5203), pairs slides by
 * filename, pixel-diffs each pair, and writes the report.
 *
 * Pairing logic: strips the "-v2" suffix from the v2 presentation's filenames
 * to match against the originals (filenames are expected to be identical
 * between the two folders — only the folder name differs).
 */
async function runComparison(browser, results, origName) {
  const ORIG_ID = origName;
  const V2_ID   = `${origName}-v2`;

  console.log(`\n[Compare] Fetching assets for "${ORIG_ID}" from main API (${MAIN_API}) ...`);
  let origAssets;
  try {
    origAssets = await fetchAssetsForPresentation(MAIN_API, ORIG_ID);
  } catch (err) {
    console.error(`ERROR fetching ${ORIG_ID}: ${err.message}`);
    results.push({ presentation: ORIG_ID, slide: '*', status: 'error', diffPercent: null, error: err.message });
    return;
  }

  console.log(`[Compare] Fetching assets for "${V2_ID}" from harness API (${HARNESS_API}) ...`);
  let v2Assets;
  try {
    v2Assets = await fetchAssetsForPresentation(HARNESS_API, V2_ID);
  } catch (err) {
    console.error(`ERROR fetching ${V2_ID}: ${err.message}`);
    results.push({ presentation: V2_ID, slide: '*', status: 'error', diffPercent: null, error: err.message });
    return;
  }

  // Build a map of filename -> asset for v2 so we can pair by filename
  const v2ByFilename = new Map(v2Assets.map(a => [a.filename, a]));

  console.log(`[Compare] ${origAssets.length} original slide(s), ${v2Assets.length} v2 slide(s)`);

  for (const origAsset of origAssets) {
    const filename = origAsset.filename;

    // Find matching v2 slide (same filename, same folder with -v2 suffix)
    const v2Asset = v2ByFilename.get(filename);
    if (!v2Asset) {
      console.log(`  ${filename} ... SKIP (no matching v2 slide)`);
      results.push({ presentation: `${ORIG_ID} vs ${V2_ID}`, slide: filename, status: 'error', diffPercent: null, error: 'no matching v2 slide' });
      continue;
    }

    const isManual = MANUAL_REVIEW_PATTERNS.some(pat => filename.includes(pat) || origAsset.id.includes(pat));
    process.stdout.write(`  ${filename}${isManual ? ' [manual-review]' : ''} ... `);

    if (isManual) {
      console.log('skipped');
      results.push({ presentation: `${ORIG_ID} vs ${V2_ID}`, slide: filename, status: 'manual-review', diffPercent: null });
      continue;
    }

    // Original: direct static URL from main server, with harness tokens injected
    // via page.addStyleTag so both sides have the same token context. Slides that
    // define their own :root values will override (correct behaviour — same as harness).
    const origUrl = slideUrl(MAIN_STATIC, ORIG_ID, filename);

    // v2: routed through harness-shell.html (fragments need fonts + CSS tokens)
    const v2Url = harnessSlideUrl(V2_ID, filename);

    let origBuf, v2Buf;

    try {
      origBuf = await screenshotWithTokens(browser, origUrl);
    } catch (err) {
      console.log(`ERROR (original): ${err.message}`);
      results.push({ presentation: `${ORIG_ID} vs ${V2_ID}`, slide: filename, status: 'error', diffPercent: null, error: `original: ${err.message}` });
      continue;
    }

    try {
      v2Buf = await screenshot(browser, v2Url);
    } catch (err) {
      console.log(`ERROR (v2 harness): ${err.message}`);
      results.push({ presentation: `${ORIG_ID} vs ${V2_ID}`, slide: filename, status: 'error', diffPercent: null, error: `v2 harness: ${err.message}` });
      continue;
    }

    const { diffPercent, diffPng } = pixelDiff(origBuf, v2Buf);
    const passed = diffPercent <= DIFF_THRESHOLD;
    const status = passed ? 'pass' : 'fail';

    console.log(`${status.toUpperCase()} (diff: ${(diffPercent * 100).toFixed(2)}%)`);

    const subdir  = passed ? 'pass' : 'flagged';
    const imgName = `poc__${toFilenameSegment(origAsset.id)}.png`;
    const imgPath = path.join(OUTPUT_DIR, subdir, imgName);
    saveSideBySide(origBuf, v2Buf, diffPng, imgPath);

    results.push({ presentation: `${ORIG_ID} vs ${V2_ID}`, slide: filename, status, diffPercent });
  }
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

async function main() {
  // Parse CLI args
  const args = process.argv.slice(2);
  const isPoc = args.includes('--poc');
  const presArgIdx = args.indexOf('--presentation');
  const targetId = presArgIdx !== -1 ? args[presArgIdx + 1] : null;

  // --compare mode: compare <id> (original) vs <id>-v2 (harness)
  // Usage: node pipeline.js --compare claude-plugin-marketplace
  const compareArgIdx = args.indexOf('--compare');
  const compareId = compareArgIdx !== -1 ? args[compareArgIdx + 1] : null;

  // --compare-all mode: compare ALL presentations that have a -v2 counterpart
  // Usage: node pipeline.js --compare-all
  const compareAll = args.includes('--compare-all');

  // Setup output dirs
  fs.mkdirSync(path.join(OUTPUT_DIR, 'pass'),    { recursive: true });
  fs.mkdirSync(path.join(OUTPUT_DIR, 'flagged'), { recursive: true });

  // ---------------------------------------------------------------------------
  // PoC mode: compare color-exploration vs color-exploration-v2
  // ---------------------------------------------------------------------------
  if (isPoc || compareId) {
    const presentationName = compareId || 'color-exploration';
    console.log(`[Compare mode] ${presentationName} (main :5201) vs ${presentationName}-v2 (harness-shell :5203)`);
    const browser = await chromium.launch({ args: ["--disable-cache", "--disable-application-cache"] });
    const results = [];
    try {
      await runComparison(browser, results, presentationName);
    } finally {
      await browser.close();
    }
    const { fail, errors } = writeReport(results);
    if (fail.length > 0 || errors.length > 0) {
      process.exit(1);
    }
    return;
  }

  // --compare-all: run all presentations that have a -v2 counterpart on the harness server
  if (compareAll) {
    console.log(`[Compare-all mode] Fetching presentation list from main API (${MAIN_API}) ...`);
    let listBody;
    try {
      listBody = await fetchJson(`${MAIN_API}/api/presentations`);
    } catch (err) {
      console.error(`ERROR: Cannot reach main API at ${MAIN_API}. Is the server running?`);
      console.error(err.message);
      process.exit(1);
    }

    const allPresentations = listBody.data || [];
    const origIds = new Set(allPresentations.map(p => p.id));

    // Fetch v2 list from harness API to discover which originals have been migrated
    let harnessListBody;
    try {
      harnessListBody = await fetchJson(`${HARNESS_API}/api/presentations`);
    } catch (err) {
      console.error(`ERROR: Cannot reach harness API at ${HARNESS_API}. Is the worktree server running?`);
      console.error(err.message);
      process.exit(1);
    }
    const harnessIds = new Set((harnessListBody.data || []).map(p => p.id));

    // Find originals that have a -v2 counterpart on the harness server
    const toCompare = allPresentations
      .filter(p => !p.id.endsWith('-v2') && harnessIds.has(`${p.id}-v2`))
      .map(p => p.id)
      .sort();

    if (toCompare.length === 0) {
      console.error('No presentations with -v2 counterparts found. Have you run the migrations?');
      process.exit(1);
    }

    console.log(`Found ${toCompare.length} presentation(s) with -v2 counterparts:\n  ${toCompare.join('\n  ')}\n`);

    const browser = await chromium.launch({ args: ["--disable-cache", "--disable-application-cache"] });
    const results = [];
    try {
      for (const name of toCompare) {
        await runComparison(browser, results, name);
      }
    } finally {
      await browser.close();
    }

    const { fail, errors } = writeReport(results);
    if (fail.length > 0 || errors.length > 0) {
      process.exit(1);
    }
    return;
  }

  // ---------------------------------------------------------------------------
  // 1. Fetch presentation list from main API
  //    Response: { success: true, data: Presentation[], _context: {...} }
  // ---------------------------------------------------------------------------
  console.log(`Fetching presentations from ${MAIN_API}/api/presentations ...`);
  let listBody;
  try {
    listBody = await fetchJson(`${MAIN_API}/api/presentations`);
  } catch (err) {
    console.error(`ERROR: Cannot reach main API at ${MAIN_API}. Is the main branch server running?`);
    console.error(err.message);
    process.exit(1);
  }

  const allPresentations = listBody.data || [];

  if (allPresentations.length === 0) {
    console.error('No presentations found. Check that presentationsRoot is configured and contains presentation folders.');
    process.exit(1);
  }

  // Filter to target if --presentation was provided
  const targets = targetId
    ? allPresentations.filter(p => p.id === targetId || p.name === targetId)
    : allPresentations;

  if (targets.length === 0) {
    console.error(`No presentations found matching: "${targetId}"`);
    console.error(`Available: ${allPresentations.map(p => p.id).join(', ')}`);
    process.exit(1);
  }

  console.log(`Processing ${targets.length} presentation(s): ${targets.map(p => p.id).join(', ')}`);

  // ---------------------------------------------------------------------------
  // 2. Launch browser
  // ---------------------------------------------------------------------------
  const browser = await chromium.launch({ args: ["--disable-cache", "--disable-application-cache"] });
  const results = [];

  try {
    for (const pres of targets) {
      console.log(`\n── Presentation: ${pres.id} ──`);

      // Fetch full presentation to get the assets array
      // Response: { success: true, data: Presentation, _context: {...} }
      let presBody;
      try {
        presBody = await fetchJson(`${MAIN_API}/api/presentations/${pres.id}`);
      } catch (err) {
        console.error(`  ERROR fetching presentation details: ${err.message}`);
        results.push({ presentation: pres.id, slide: '*', status: 'error', diffPercent: null, error: err.message });
        continue;
      }

      // assets: Asset[] — each has { id, filename, name, isIndex, group, ... }
      const assets = (presBody.data && presBody.data.assets) ? presBody.data.assets : [];

      if (assets.length === 0) {
        console.log('  No assets found — skipping.');
        continue;
      }

      for (const asset of assets) {
        const assetId  = asset.id;       // filename without extension (e.g. "intro")
        const filename = asset.filename; // full filename (e.g. "intro.html")

        const isManual = MANUAL_REVIEW_PATTERNS.some(pat => assetId.includes(pat) || filename.includes(pat));

        process.stdout.write(`  ${filename}${isManual ? ' [manual-review]' : ''} ... `);

        if (isManual) {
          console.log('skipped');
          results.push({ presentation: pres.id, slide: filename, status: 'manual-review', diffPercent: null });
          continue;
        }

        // Original: direct static URL with harness tokens injected via addStyleTag.
        // v2 fragment: routed through harness-shell.html (which injects the same tokens).
        // Both sides have identical token context for a fair diff.
        const mainUrl    = slideUrl(MAIN_STATIC, pres.id, filename);
        const harnessUrl = harnessSlideUrl(pres.id, filename);

        let mainBuf, harnessBuf;

        try {
          mainBuf = await screenshotWithTokens(browser, mainUrl);
        } catch (err) {
          console.log(`ERROR (main): ${err.message}`);
          results.push({ presentation: pres.id, slide: filename, status: 'error', diffPercent: null, error: `main: ${err.message}` });
          continue;
        }

        try {
          harnessBuf = await screenshot(browser, harnessUrl);
        } catch (err) {
          console.log(`ERROR (harness): ${err.message}`);
          results.push({ presentation: pres.id, slide: filename, status: 'error', diffPercent: null, error: `harness: ${err.message}` });
          continue;
        }

        // Pixel diff
        const { diffPercent, diffPng } = pixelDiff(mainBuf, harnessBuf);
        const passed = diffPercent <= DIFF_THRESHOLD;
        const status = passed ? 'pass' : 'fail';

        console.log(`${status.toUpperCase()} (diff: ${(diffPercent * 100).toFixed(2)}%)`);

        // Save side-by-side comparison image
        const subdir   = passed ? 'pass' : 'flagged';
        const imgName  = `${toFilenameSegment(pres.id)}__${toFilenameSegment(assetId)}.png`;
        const imgPath  = path.join(OUTPUT_DIR, subdir, imgName);
        saveSideBySide(mainBuf, harnessBuf, diffPng, imgPath);

        results.push({ presentation: pres.id, slide: filename, status, diffPercent });
      }
    }
  } finally {
    await browser.close();
  }

  // ---------------------------------------------------------------------------
  // 3. Write report and exit with appropriate code
  // ---------------------------------------------------------------------------
  const { fail, errors } = writeReport(results);

  if (fail.length > 0 || errors.length > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\nUnhandled error:', err);
  process.exit(1);
});
