#!/usr/bin/env node
/**
 * FliDeck Type A Migration Toolchain
 *
 * Strips HTML/head/body wrapper from pure HTML/CSS slides.
 * Produces a -v2 folder alongside the original.
 * Safe to re-run — skips files already migrated (has harness-fragment comment).
 *
 * Usage:
 *   node tools/migrate-type-a.js <presentation-name>
 *   node tools/migrate-type-a.js claude-plugin-marketplace
 *
 * Output:
 *   [presentationsRoot]/[name]-v2/   (created alongside original)
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Config ────────────────────────────────────────────────────────────────────

function resolveConfigPath() {
  // Run from repo root or tools/ subdirectory
  const candidates = [
    path.join(__dirname, '..', 'config.json'),
    path.join(process.cwd(), 'config.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    'config.json not found. Run from flideck root or ensure config.json exists.'
  );
}

function expandTilde(p) {
  if (p.startsWith('~/') || p === '~') {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

function loadPresentationsRoot() {
  const configPath = resolveConfigPath();
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!config.presentationsRoot) {
    throw new Error('config.json is missing "presentationsRoot"');
  }
  return expandTilde(config.presentationsRoot);
}

// ── HTML Fragment Extraction ──────────────────────────────────────────────────

/**
 * Returns true if the file has already been migrated (contains harness-fragment marker).
 */
function isAlreadyMigrated(html) {
  return /<!--\s*harness-fragment\s*:/.test(html);
}

/**
 * Returns true if any <script> tag is present in the HTML.
 * Checks for both inline scripts and src-based scripts.
 */
function hasScript(html) {
  return /<script[\s>]/i.test(html);
}

/**
 * Extracts all <style>...</style> block contents from a string of HTML.
 * Handles multi-line style blocks (DOTALL via [\s\S]).
 * Returns an array of style content strings (without the <style> tags).
 */
function extractStyleBlocks(html) {
  const stylePattern = /<style[^>]*>([\s\S]*?)<\/style\s*>/gi;
  const styles = [];
  let match;
  while ((match = stylePattern.exec(html)) !== null) {
    const content = match[1].trim();
    if (content) {
      styles.push(content);
    }
  }
  return styles;
}

/**
 * Strips the full document wrapper from an HTML file and returns a harness fragment.
 *
 * Steps:
 *   1. Strip BOM if present
 *   2. Skip empty files
 *   3. Skip already-migrated files (idempotent)
 *   4. Detect scripts → warn and skip
 *   5. Extract all <style> block contents from anywhere in the document
 *   6. Remove the entire <head>...</head> block
 *   7. Remove <!DOCTYPE ...>, <html ...>, </html>, <body ...>, </body> tags
 *   8. Remove any remaining <style> blocks (already captured above)
 *   9. Trim resulting body content
 *   10. Reassemble: comment marker + consolidated <style> block + body content
 *
 * @param {string} html - Raw file content
 * @param {string} filename - Used only for error messages
 * @returns {{ fragment: string } | { skip: true, reason: string } | { warn: true, reason: string }}
 */
function extractFragment(html, filename) {
  // Strip BOM
  if (html.charCodeAt(0) === 0xfeff) {
    html = html.slice(1);
  }

  // Skip empty files
  if (!html.trim()) {
    return { skip: true, reason: 'empty file' };
  }

  // Already migrated — idempotent skip
  if (isAlreadyMigrated(html)) {
    return { skip: true, reason: 'already migrated (harness-fragment marker found)' };
  }

  // Script detection — do not migrate Type B/C files
  if (hasScript(html)) {
    return {
      warn: true,
      reason: 'script tag found — classify manually (Type B or C)',
    };
  }

  // Extract all style block contents before any removal (captures head styles)
  const styleContents = extractStyleBlocks(html);

  // Remove entire <head>...</head> block (multi-line, DOTALL)
  let fragment = html.replace(/<head[\s\S]*?<\/head\s*>/gi, '');

  // Remove structural wrapper tags (open and close, with any attributes)
  fragment = fragment.replace(/<!DOCTYPE[^>]*>/gi, '');
  fragment = fragment.replace(/<html[^>]*>/gi, '');
  fragment = fragment.replace(/<\/html\s*>/gi, '');
  fragment = fragment.replace(/<body[^>]*>/gi, '');
  fragment = fragment.replace(/<\/body\s*>/gi, '');

  // Remove any <style> blocks that survived in the body
  // (already captured above; remove to avoid duplication)
  fragment = fragment.replace(/<style[^>]*>[\s\S]*?<\/style\s*>/gi, '');

  // Trim leading/trailing whitespace from body content
  fragment = fragment.trim();

  // Assemble the final fragment
  const parts = ['<!-- harness-fragment: type-a -->'];

  if (styleContents.length > 0) {
    parts.push('<style>');
    parts.push(styleContents.join('\n\n'));
    parts.push('</style>');
  }

  if (fragment) {
    parts.push(fragment);
  }

  return { fragment: parts.join('\n') };
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node tools/migrate-type-a.js <presentation-name>');
    console.error('Example: node tools/migrate-type-a.js claude-plugin-marketplace');
    process.exit(1);
  }

  const presentationName = args[0];
  const presentationsRoot = loadPresentationsRoot();
  const sourceDir = path.join(presentationsRoot, presentationName);
  const outputDir = path.join(presentationsRoot, `${presentationName}-v2`);

  // Validate source
  if (!fs.existsSync(sourceDir)) {
    console.error(`Error: source presentation not found: ${sourceDir}`);
    process.exit(1);
  }
  if (!fs.statSync(sourceDir).isDirectory()) {
    console.error(`Error: not a directory: ${sourceDir}`);
    process.exit(1);
  }

  // Collect HTML files
  const htmlFiles = fs
    .readdirSync(sourceDir)
    .filter((f) => f.toLowerCase().endsWith('.html'))
    .sort();

  if (htmlFiles.length === 0) {
    console.log(`No .html files found in ${sourceDir}`);
    process.exit(0);
  }

  // Create output directory
  fs.mkdirSync(outputDir, { recursive: true });

  // Counters
  const results = {
    migrated: [],
    skipped: [],
    warned: [],
  };

  console.log(`\nFliDeck Type A Migration`);
  console.log(`  Source : ${sourceDir}`);
  console.log(`  Output : ${outputDir}`);
  console.log(`  Files  : ${htmlFiles.length} HTML files found\n`);

  // Copy non-HTML assets (images, fonts, etc.) to v2 folder so that relative
  // references in fragments (e.g. <img src="slide.png">) resolve correctly
  // when the fragment is served from the v2 folder via harness-shell.
  const ASSET_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.eot']);
  const allFiles = fs.readdirSync(sourceDir);
  let assetsCopied = 0;
  for (const f of allFiles) {
    const ext = path.extname(f).toLowerCase();
    if (ASSET_EXTENSIONS.has(ext)) {
      const srcAsset = path.join(sourceDir, f);
      const dstAsset = path.join(outputDir, f);
      if (!fs.existsSync(dstAsset)) {
        fs.copyFileSync(srcAsset, dstAsset);
        assetsCopied++;
      }
    }
  }
  if (assetsCopied > 0) {
    console.log(`  Assets : ${assetsCopied} non-HTML asset(s) copied\n`);
  }

  for (const filename of htmlFiles) {
    const srcPath = path.join(sourceDir, filename);
    const dstPath = path.join(outputDir, filename);
    const html = fs.readFileSync(srcPath, 'utf8');

    const result = extractFragment(html, filename);

    if (result.skip) {
      console.log(`  SKIP   ${filename} — ${result.reason}`);
      results.skipped.push({ filename, reason: result.reason });
      continue;
    }

    if (result.warn) {
      console.log(`  WARN   ${filename} — ${result.reason}`);
      results.warned.push({ filename, reason: result.reason });
      continue;
    }

    // Write the migrated fragment
    fs.writeFileSync(dstPath, result.fragment, 'utf8');
    console.log(`  OK     ${filename}`);
    results.migrated.push(filename);
  }

  // Summary
  console.log('\n─────────────────────────────────────────────────');
  console.log(`Summary for "${presentationName}":`);
  console.log(`  Migrated : ${results.migrated.length}`);
  console.log(`  Skipped  : ${results.skipped.length} (already done or empty)`);
  console.log(`  Warned   : ${results.warned.length} (script found — manual review needed)`);

  if (results.warned.length > 0) {
    console.log('\nFiles requiring manual review:');
    for (const { filename, reason } of results.warned) {
      console.log(`  ! ${filename}: ${reason}`);
    }
  }

  if (results.migrated.length > 0) {
    console.log(`\nOutput written to: ${outputDir}`);
  }

  console.log('─────────────────────────────────────────────────\n');
}

main();
