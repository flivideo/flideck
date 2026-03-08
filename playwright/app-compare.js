/**
 * FliDeck App-Level Visual Comparison
 *
 * Screenshots the FULL FliDeck React application (chrome + slide content) on two
 * versions running side by side, then pixel-diffs them:
 *
 *   OLD = iframe-based rendering  →  port 5202 (client) / 5203 (API)
 *         worktree: .worktrees/harness-migration
 *
 *   NEW = HarnessViewer rendering →  port 5200 (client) / 5201 (API)
 *         main branch
 *
 * Unlike pipeline.js (which bypasses the React app entirely), this script drives
 * the real UI: it navigates to /presentation/:id, clicks each slide in the sidebar,
 * waits for the content to load, and screenshots the full viewport.  Chrome issues
 * (broken tabs, sidebar, backgrounds) are visible here but not in pipeline.js.
 *
 * Usage:
 *   node app-compare.js                                          # all presentations, 10 slides each
 *   node app-compare.js --presentation bmad-poem                 # one presentation, 10 slides
 *   node app-compare.js --presentation bmad-poem --limit 30      # one presentation, 30 slides
 *   node app-compare.js --limit 0                                # all presentations, all slides
 *   node app-compare.js --no-headless                            # show browser window
 *
 * Start both servers first:
 *   Terminal 1 (main):    cd /path/to/flideck && npm run dev
 *   Terminal 2 (worktree): cd .worktrees/harness-migration && npm run dev
 *
 * Output:
 *   playwright/output/app-compare/pass/    — side-by-side PNGs (old | new | diff)
 *   playwright/output/app-compare/flagged/ — failing slides
 *   playwright/output/app-compare/report.md
 *   playwright/output/app-compare/results.json
 */

'use strict';

const { chromium } = require('playwright');
const pixelmatch    = require('pixelmatch');
const { PNG }       = require('pngjs');
const fs            = require('fs');
const path          = require('path');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const OLD_CLIENT = 'http://localhost:5202'; // worktree — iframe rendering
const NEW_CLIENT = 'http://localhost:5200'; // main     — HarnessViewer

const OLD_API = 'http://localhost:5203/api';
const NEW_API = 'http://localhost:5201/api';

const VIEWPORT      = { width: 1280, height: 800 };
const DIFF_THRESHOLD = 0.01; // 1% — slides above this are flagged

const OUTPUT_DIR  = path.join(__dirname, 'output', 'app-compare');
const PASS_DIR    = path.join(OUTPUT_DIR, 'pass');
const FLAGGED_DIR = path.join(OUTPUT_DIR, 'flagged');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args              = process.argv.slice(2);
const presentationArg   = args.includes('--presentation') ? args[args.indexOf('--presentation') + 1] : null;
const limitArg          = args.includes('--limit')        ? parseInt(args[args.indexOf('--limit') + 1], 10) : 10;
const headless          = !args.includes('--no-headless');

const SLIDE_LIMIT = isNaN(limitArg) ? 10 : limitArg; // 0 = unlimited

// ---------------------------------------------------------------------------
// Helpers — shared with pipeline.js
// ---------------------------------------------------------------------------

async function fetchJson(url) {
  let resp;
  try {
    resp = await fetch(url);
  } catch (err) {
    throw new Error(`Network error fetching ${url}: ${err.message}`);
  }
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${url}`);
  return resp.json();
}

function pixelDiff(bufA, bufB) {
  const imgA = PNG.sync.read(bufA);
  const imgB = PNG.sync.read(bufB);
  if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
    return { numDiff: -1, diffPercent: 1.0, diffPng: null };
  }
  const { width, height } = imgA;
  const diff = new PNG({ width, height });
  const numDiff = pixelmatch(imgA.data, imgB.data, diff.data, width, height, { threshold: 0.1 });
  return { numDiff, diffPercent: numDiff / (width * height), diffPng: diff };
}

function saveSideBySide(leftBuf, rightBuf, diffPng, outputPath) {
  const left  = PNG.sync.read(leftBuf);
  const right = PNG.sync.read(rightBuf);
  const w = left.width;
  const h = left.height;
  const panelWidth = Math.max(left.width, right.width);
  const combined = new PNG({ width: panelWidth * 3, height: h });
  combined.data.fill(0);
  PNG.bitblt(left,  combined, 0, 0, left.width,  h, 0,             0);
  PNG.bitblt(right, combined, 0, 0, right.width, h, panelWidth,     0);
  if (diffPng) PNG.bitblt(diffPng, combined, 0, 0, w, h, panelWidth * 2, 0);
  fs.writeFileSync(outputPath, PNG.sync.write(combined));
}

function toFilenameSegment(str) {
  return str.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getQuality(diffPercent) {
  if (diffPercent == null) return 'n/a';
  if (diffPercent < 0.001) return 'perfect';
  if (diffPercent < 0.005) return 'excellent';
  if (diffPercent < 0.010) return 'good';
  if (diffPercent < 0.030) return 'review';
  return 'fail';
}

// ---------------------------------------------------------------------------
// App navigation helpers
// ---------------------------------------------------------------------------

/**
 * Clear FliDeck localStorage keys so both versions start with default layout:
 * - no collapsed sidebar groups
 * - default sidebar width
 */
async function clearFliDeckStorage(page) {
  await page.evaluate(() => {
    localStorage.removeItem('flideck-collapsed-groups');
    localStorage.removeItem('flideck-sidebar-width');
  });
}

/**
 * Navigate to the presentation page and wait for the sidebar to be ready.
 * Go to root first to clear localStorage, then navigate to the presentation.
 */
async function navigateToPresentationPage(page, clientBase, presentationId) {
  // Visit root page first so we have a context to clear localStorage
  await page.goto(clientBase, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await clearFliDeckStorage(page);
  // Now navigate directly to the presentation (no reload needed)
  await page.goto(`${clientBase}/presentation/${presentationId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Wait for the sidebar — large presentations (300+ assets) take time to render
  await page.locator('aside').waitFor({ state: 'visible', timeout: 30000 });
  // Brief settle for the asset list to populate
  await page.waitForTimeout(500);
}

/**
 * Click a slide in the sidebar by asset index (positional, most reliable).
 * Falls back to text match if index is out of bounds.
 */
async function clickSlideInSidebar(page, assetIndex, assetName) {
  // All clickable asset buttons inside the sidebar
  const buttons = page.locator('aside button').filter({ hasText: /\S/ });
  const count = await buttons.count();

  if (assetIndex < count) {
    await buttons.nth(assetIndex).click();
  } else {
    // Fallback: text match
    const byText = page.locator('aside button').filter({ hasText: assetName }).first();
    if (await byText.count() > 0) {
      await byText.click();
    } else {
      throw new Error(`Cannot find sidebar button for "${assetName}" (index ${assetIndex}, total ${count})`);
    }
  }
}

/**
 * Wait for the old version (iframe) slide to finish loading.
 */
async function waitForOldSlide(page) {
  // AssetViewer renders an iframe[title="Asset Preview"] with srcdoc
  try {
    await page.locator('iframe[title="Asset Preview"]').waitFor({ state: 'visible', timeout: 12000 });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  } catch {
    // If no iframe, might be loading or empty state — just wait briefly
    await page.waitForTimeout(500);
  }
}

/**
 * Wait for the new version (HarnessViewer) slide to finish loading.
 */
async function waitForNewSlide(page) {
  // Loading spinner disappears, then harness-slide has content
  try {
    // Wait for loading spinner to go away
    const spinner = page.locator('text=Loading asset...');
    if (await spinner.count() > 0) {
      await spinner.waitFor({ state: 'hidden', timeout: 10000 });
    }
    await page.locator('.harness-slide').waitFor({ state: 'visible', timeout: 10000 });
    // Brief settle for injected scripts to execute
    await page.waitForTimeout(300);
  } catch {
    await page.waitForTimeout(500);
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function writeReport(results) {
  const enriched = results.map(r => ({
    ...r,
    diffPct:  r.diffPercent != null ? parseFloat((r.diffPercent * 100).toFixed(4)) : null,
    quality:  (r.status === 'pass' || r.status === 'fail') ? getQuality(r.diffPercent) : r.status,
  }));

  const pass    = enriched.filter(r => r.status === 'pass');
  const fail    = enriched.filter(r => r.status === 'fail');
  const errors  = enriched.filter(r => r.status === 'error');
  const now     = new Date().toISOString();

  // JSON
  const json = {
    generatedAt: now,
    mode: 'app-compare (old=iframe port 5202, new=HarnessViewer port 5200)',
    summary: {
      total: enriched.length,
      pass: pass.length,
      fail: fail.length,
      error: errors.length,
      qualityCounts: ['perfect','excellent','good','review','fail','n/a'].reduce((acc, q) => {
        acc[q] = enriched.filter(r => r.quality === q).length; return acc;
      }, {}),
    },
    threshold: { diffPercent: DIFF_THRESHOLD * 100 },
    results: enriched.map(r => ({
      presentation: r.presentation,
      slide:        r.slide,
      status:       r.status,
      diffPct:      r.diffPct,
      quality:      r.quality,
      error:        r.error || null,
    })),
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, 'results.json'), JSON.stringify(json, null, 2));

  // Markdown
  const rows = enriched.map(r => {
    const pct = r.diffPct != null ? `${r.diffPct.toFixed(2)}%` : 'n/a';
    const icon = r.status === 'pass' ? '✅' : r.status === 'error' ? '❌' : '🔴';
    return `| ${icon} | ${r.presentation} | ${r.slide} | ${pct} | ${r.quality} |`;
  }).join('\n');

  const md = [
    `# App-Compare Report`,
    ``,
    `**Generated**: ${now}`,
    `**Mode**: old (iframe, port 5202) vs new (HarnessViewer, port 5200)`,
    `**Threshold**: ${DIFF_THRESHOLD * 100}%`,
    ``,
    `## Summary`,
    ``,
    `- Total: ${enriched.length} | Pass: ${pass.length} | Fail: ${fail.length} | Error: ${errors.length}`,
    `- Quality: perfect=${json.summary.qualityCounts.perfect} excellent=${json.summary.qualityCounts.excellent} good=${json.summary.qualityCounts.good} review=${json.summary.qualityCounts.review} fail=${json.summary.qualityCounts.fail}`,
    ``,
    `## Results`,
    ``,
    `| | Presentation | Slide | Diff% | Quality |`,
    `|---|---|---|---|---|`,
    rows,
  ].join('\n');

  fs.writeFileSync(path.join(OUTPUT_DIR, 'report.md'), md);

  const failPct = enriched.length > 0 ? ((fail.length / enriched.length) * 100).toFixed(1) : '0';
  console.log(`\n── Report written to ${OUTPUT_DIR}`);
  console.log(`   Total: ${enriched.length} | Pass: ${pass.length} | Fail: ${fail.length} | Error: ${errors.length} | Fail rate: ${failPct}%`);
  console.log(`   Quality: perfect=${json.summary.qualityCounts.perfect} excellent=${json.summary.qualityCounts.excellent} good=${json.summary.qualityCounts.good} review=${json.summary.qualityCounts.review} fail=${json.summary.qualityCounts.fail}`);

  return { fail: fail.length, errors: errors.length };
}

// ---------------------------------------------------------------------------
// Per-presentation comparison
// ---------------------------------------------------------------------------

async function comparePresentation(browser, results, presentationId) {
  console.log(`\n── Comparing: ${presentationId}`);

  // Fetch asset list from new API (same presentations root as old)
  let assets;
  try {
    const resp = await fetchJson(`${NEW_API}/presentations/${presentationId}`);
    assets = resp.data?.assets ?? resp.assets ?? [];
  } catch (err) {
    console.error(`  ERROR fetching assets: ${err.message}`);
    results.push({ presentation: presentationId, slide: '(all)', status: 'error', diffPercent: null, error: err.message });
    return;
  }

  if (assets.length === 0) {
    console.log(`  No assets found — skipping`);
    return;
  }

  const limit  = SLIDE_LIMIT > 0 ? Math.min(SLIDE_LIMIT, assets.length) : assets.length;
  const subset = assets.slice(0, limit);
  console.log(`  ${assets.length} assets total, comparing first ${limit}`);

  // Open two pages
  const oldPage = await browser.newPage();
  const newPage = await browser.newPage();
  await oldPage.setViewportSize(VIEWPORT);
  await newPage.setViewportSize(VIEWPORT);

  try {
    // Navigate both to the presentation
    await Promise.all([
      navigateToPresentationPage(oldPage, OLD_CLIENT, presentationId),
      navigateToPresentationPage(newPage, NEW_CLIENT, presentationId),
    ]);

    // Compare each slide
    for (let i = 0; i < subset.length; i++) {
      const asset = subset[i];
      const label = `${i + 1}/${limit}: ${asset.filename}`;
      process.stdout.write(`  ${label} ... `);

      try {
        // Click same index in both sidebars
        await Promise.all([
          clickSlideInSidebar(oldPage, i, asset.name),
          clickSlideInSidebar(newPage, i, asset.name),
        ]);

        // Wait for each version to finish loading
        await Promise.all([
          waitForOldSlide(oldPage),
          waitForNewSlide(newPage),
        ]);

        // Screenshot both
        const [oldBuf, newBuf] = await Promise.all([
          oldPage.screenshot(),
          newPage.screenshot(),
        ]);

        // Diff
        const { diffPercent, diffPng } = pixelDiff(oldBuf, newBuf);
        const status  = diffPercent <= DIFF_THRESHOLD ? 'pass' : 'fail';
        const quality = getQuality(diffPercent);
        const pct     = (diffPercent * 100).toFixed(2);

        console.log(`${pct}% (${quality}) → ${status}`);

        // Save side-by-side
        const fname    = `${toFilenameSegment(presentationId)}__${toFilenameSegment(asset.id || asset.filename)}.png`;
        const outDir   = status === 'pass' ? PASS_DIR : FLAGGED_DIR;
        saveSideBySide(oldBuf, newBuf, diffPng, path.join(outDir, fname));

        results.push({ presentation: presentationId, slide: asset.filename, status, diffPercent, error: null });

      } catch (err) {
        console.log(`ERROR: ${err.message}`);
        results.push({ presentation: presentationId, slide: asset.filename, status: 'error', diffPercent: null, error: err.message });
      }
    }

  } finally {
    await oldPage.close();
    await newPage.close();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Ensure output dirs exist
  [OUTPUT_DIR, PASS_DIR, FLAGGED_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

  // Sanity-check both servers are reachable
  console.log('Checking server health...');
  try {
    await fetchJson(`${NEW_API.replace('/api', '')}/api/health`);
    console.log(`  ✓ New (HarnessViewer) server: ${NEW_API}`);
  } catch (err) {
    console.error(`  ✗ New server not reachable at ${NEW_API}: ${err.message}`);
    console.error('    Start it with: npm run dev (from flideck root)');
    process.exit(1);
  }
  try {
    await fetchJson(`${OLD_API.replace('/api', '')}/api/health`);
    console.log(`  ✓ Old (iframe) server:        ${OLD_API}`);
  } catch (err) {
    console.error(`  ✗ Old server not reachable at ${OLD_API}: ${err.message}`);
    console.error('    Start it with: npm run dev (from .worktrees/harness-migration)');
    process.exit(1);
  }

  // Get presentations to compare
  let presentationIds;
  if (presentationArg) {
    presentationIds = [presentationArg];
  } else {
    const resp = await fetchJson(`${NEW_API}/presentations`);
    const all  = resp.data ?? resp ?? [];
    // Skip -v2 presentations — we're comparing the same pres on two app versions
    presentationIds = all.filter(p => !p.id.endsWith('-v2')).map(p => p.id).sort();
  }

  console.log(`\nComparing ${presentationIds.length} presentation(s), up to ${SLIDE_LIMIT || 'all'} slides each`);
  console.log(`Left = old (iframe, :5202) | Right = new (HarnessViewer, :5200) | Panel 3 = diff\n`);

  const browser = await chromium.launch({ headless });
  const results = [];

  try {
    for (const id of presentationIds) {
      await comparePresentation(browser, results, id);
    }
  } finally {
    await browser.close();
  }

  writeReport(results);
  process.exit(results.some(r => r.status === 'fail') ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
