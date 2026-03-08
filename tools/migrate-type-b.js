#!/usr/bin/env node
/**
 * FliDeck Type B Migration Toolchain
 *
 * Extends Type A migration to handle known-safe JS patterns:
 * - copyCommand / copyInline function definitions → removed (harness provides these on window)
 * - copyCommand(el) / copyInline(el) call sites → rewritten to window.copyCommand(el) / window.copyInline(el)
 * - Simple CSS class toggle functions → left as-is (safe to keep inline)
 * - Unknown/complex scripts → flagged as Type C, not migrated
 *
 * Usage:
 *   node tools/migrate-type-b.js <presentation-name>
 *
 * Output:
 *   [presentationsRoot]/[name]-v2/
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Config ────────────────────────────────────────────────────────────────────

function resolveConfigPath() {
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

// ── HTML Fragment Extraction (Type A logic) ───────────────────────────────────

function isAlreadyMigrated(html) {
  return /<!--\s*harness-fragment\s*:/.test(html);
}

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

// ── Type B Script Analysis ────────────────────────────────────────────────────

/**
 * Token patterns that indicate Type C (complex/unsafe JS).
 *
 * A file is flagged Type C if any of these patterns appear in a script block
 * after copyCommand/copyInline definitions have been stripped.
 */
const TYPE_C_PATTERNS = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\baxios\b/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bIndexedDB\b/,
  /\bWebSocket\b/,
  /\beval\s*\(/,
  /\bsetInterval\s*\(/,
  /\bsetTimeout\s*\(/,
  // Custom copyToClipboard implementations — not harness utilities
  /\bcopyToClipboard\s*\(/,
  // Keyboard listeners that compete with FliDeck harness navigation
  /ArrowDown|ArrowRight|ArrowUp|ArrowLeft/,
  // navigator APIs other than clipboard
  /\bnavigator\.(geolocation|mediaDevices|getUserMedia|serviceWorker)\b/,
  // Dynamic script loading
  /\bdocument\.write\b/,
  /\bcreateElement\s*\(\s*['"]script['"]\s*\)/,
  // Non-click event listeners (excluding click which is safe)
  /addEventListener\s*\(\s*['"](?!click['"])(?:keydown|keyup|keypress|scroll|resize|change|input|submit)\b/,
];

/**
 * Removes copyCommand and copyInline function definitions from a JS string.
 *
 * Handles:
 *   function copyCommand(el) { ... }
 *   function copyInline(el) { ... }
 *   const copyCommand = (el) => { ... };
 *   const copyInline = (el) => { ... };
 *   const copyCommand = function(el) { ... };
 *
 * Uses brace-counting to find the complete function body boundary.
 *
 * @param {string} scriptContent - raw JS content (no <script> tags)
 * @returns {string} - content with copyCommand/copyInline definitions removed
 */
function removeCopyFunctionDefinitions(scriptContent) {
  let result = scriptContent;

  // Matches the start of a copyCommand or copyInline function definition,
  // up to and including the opening '{' of the function body.
  const funcStartPattern =
    /(?:function\s+copy(?:Command|Inline)\s*\([^)]*\)|(?:const|let|var)\s+copy(?:Command|Inline)\s*=\s*(?:function\s*)?\([^)]*\)\s*(?:=>)?\s*)\s*\{/g;

  let match;
  const removals = [];

  while ((match = funcStartPattern.exec(result)) !== null) {
    // The opening '{' is the last char of the match
    const openBraceIndex = match.index + match[0].length - 1;
    let depth = 1;
    let i = openBraceIndex + 1;

    while (i < result.length && depth > 0) {
      if (result[i] === '{') depth++;
      else if (result[i] === '}') depth--;
      i++;
    }

    // i now points to the character after the closing '}'
    // Consume optional trailing semicolon and a single newline
    if (result[i] === ';') i++;
    if (result[i] === '\n') i++;

    removals.push([match.index, i]);
  }

  // Apply removals in reverse order to preserve string indices
  for (let k = removals.length - 1; k >= 0; k--) {
    const [start, end] = removals[k];
    result = result.slice(0, start) + result.slice(end);
  }

  return result;
}

/**
 * Rewrites copyCommand(...) and copyInline(...) call sites to
 * window.copyCommand(...) and window.copyInline(...).
 *
 * Excludes function definition signatures (function copyCommand / function copyInline)
 * so that the removal step can still find and strip the definitions.
 * Uses negative lookbehind for both 'window.' (avoid double-prefix) and
 * 'function ' / 'function\s' (avoid rewriting definition signature).
 *
 * Safe to apply to both inline script content and HTML attribute values (onclick=...).
 *
 * @param {string} text
 * @returns {string}
 */
function rewriteCopyCallSites(text) {
  // Rewrite copyCommand( → window.copyCommand( but NOT when preceded by 'function ' or 'window.'
  // Negative lookbehind: (?<!window\.) prevents double-prefix; (?<!function ) skips definitions
  return text
    .replace(/(?<!window\.)(?<!function )copyCommand\s*\(/g, 'window.copyCommand(')
    .replace(/(?<!window\.)(?<!function )copyInline\s*\(/g, 'window.copyInline(');
}

/**
 * Classifies a single script block's remaining content (after copyCommand/copyInline
 * definitions have been stripped and call sites rewritten).
 *
 * Returns:
 *   'empty'  — block is empty; remove the <script> tag
 *   'safe'   — block contains only known-safe patterns; keep as Type B
 *   'unsafe' — block contains Type C patterns; flag the file
 *
 * @param {string} content - trimmed JS content
 * @returns {'empty' | 'safe' | 'unsafe'}
 */
function classifyScriptContent(content) {
  if (!content.trim()) return 'empty';

  for (const pattern of TYPE_C_PATTERNS) {
    if (pattern.test(content)) {
      return 'unsafe';
    }
  }

  return 'safe';
}

// ── Per-File Migration ────────────────────────────────────────────────────────

/**
 * Migrates a single HTML file.
 *
 * Returns one of:
 *   { fragment: string, type: 'a' | 'b' }   — successfully migrated
 *   { skip: true, reason: string }           — already migrated or empty
 *   { typeC: true, reason: string }          — flagged Type C, not migrated
 *
 * @param {string} html
 * @param {string} filename
 */
function extractFragmentTypeB(html, filename) {
  // Strip BOM
  if (html.charCodeAt(0) === 0xfeff) {
    html = html.slice(1);
  }

  if (!html.trim()) {
    return { skip: true, reason: 'empty file' };
  }

  if (isAlreadyMigrated(html)) {
    return { skip: true, reason: 'already migrated (harness-fragment marker found)' };
  }

  const hasScript = /<script[\s>]/i.test(html);

  if (!hasScript) {
    // ── Pure Type A: no scripts ───────────────────────────────────────────
    const styleContents = extractStyleBlocks(html);
    let fragment = html.replace(/<head[\s\S]*?<\/head\s*>/gi, '');
    fragment = fragment.replace(/<!DOCTYPE[^>]*>/gi, '');
    fragment = fragment.replace(/<html[^>]*>/gi, '');
    fragment = fragment.replace(/<\/html\s*>/gi, '');
    fragment = fragment.replace(/<body[^>]*>/gi, '');
    fragment = fragment.replace(/<\/body\s*>/gi, '');
    fragment = fragment.replace(/<style[^>]*>[\s\S]*?<\/style\s*>/gi, '');
    fragment = fragment.trim();

    const parts = ['<!-- harness-fragment: type-a -->'];
    if (styleContents.length > 0) {
      parts.push('<style>');
      parts.push(styleContents.join('\n\n'));
      parts.push('</style>');
    }
    if (fragment) parts.push(fragment);
    return { fragment: parts.join('\n'), type: 'a' };
  }

  // ── Type B analysis: has scripts ─────────────────────────────────────────

  // Step 1: Rewrite copyCommand/copyInline call sites in HTML attributes (onclick=...)
  let processedHtml = rewriteCopyCallSites(html);

  // Step 2: Extract all <script> blocks for analysis
  // Replace them with placeholders so we can process them separately
  const scriptBlocks = [];
  let htmlWithPlaceholders = processedHtml.replace(
    /<script([^>]*)>([\s\S]*?)<\/script\s*>/gi,
    (fullMatch, attrs, content) => {
      const index = scriptBlocks.length;
      scriptBlocks.push({ fullMatch, attrs, content });
      return `\x00SCRIPT_PLACEHOLDER_${index}\x00`;
    }
  );

  // Step 3: Process each script block
  let anyTypeC = false;
  let typeCReason = '';
  const processedBlocks = [];

  for (let i = 0; i < scriptBlocks.length; i++) {
    const { attrs, content } = scriptBlocks[i];

    // External scripts (src=...) are unknown dependencies — Type C
    if (/\bsrc\s*=/.test(attrs)) {
      anyTypeC = true;
      typeCReason = `external <script src> attribute found — cannot classify`;
      break;
    }

    // Remove copyCommand/copyInline definitions (harness provides them)
    let processed = removeCopyFunctionDefinitions(content);

    // Rewrite any remaining call sites to window.copyCommand / window.copyInline
    processed = rewriteCopyCallSites(processed);

    // Classify the remaining content
    const classification = classifyScriptContent(processed.trim());

    if (classification === 'unsafe') {
      anyTypeC = true;
      typeCReason = `script block contains complex or competing patterns`;
      break;
    }

    processedBlocks.push({
      index: i,
      keep: classification === 'safe',
      content: processed,
      attrs,
    });
  }

  if (anyTypeC) {
    return { typeC: true, reason: typeCReason };
  }

  // Step 4: Rebuild HTML by substituting processed (or removed) script blocks
  let rebuiltHtml = htmlWithPlaceholders;
  for (const block of processedBlocks) {
    const placeholder = `\x00SCRIPT_PLACEHOLDER_${block.index}\x00`;
    if (!block.keep) {
      // Empty after removal — drop the entire <script> tag
      rebuiltHtml = rebuiltHtml.replace(placeholder, '');
    } else {
      rebuiltHtml = rebuiltHtml.replace(
        placeholder,
        `<script${block.attrs}>\n${block.content}\n  </script>`
      );
    }
  }

  // Step 5: Apply Type A wrapper strip to the rebuilt HTML
  const styleContents = extractStyleBlocks(rebuiltHtml);

  let fragment = rebuiltHtml.replace(/<head[\s\S]*?<\/head\s*>/gi, '');
  fragment = fragment.replace(/<!DOCTYPE[^>]*>/gi, '');
  fragment = fragment.replace(/<html[^>]*>/gi, '');
  fragment = fragment.replace(/<\/html\s*>/gi, '');
  fragment = fragment.replace(/<body[^>]*>/gi, '');
  fragment = fragment.replace(/<\/body\s*>/gi, '');
  fragment = fragment.replace(/<style[^>]*>[\s\S]*?<\/style\s*>/gi, '');
  fragment = fragment.trim();

  // Step 6: Assemble the final Type B fragment
  const parts = ['<!-- harness-fragment: type-b -->'];

  if (styleContents.length > 0) {
    parts.push('<style>');
    parts.push(styleContents.join('\n\n'));
    parts.push('</style>');
  }

  if (fragment) {
    parts.push(fragment);
  }

  return { fragment: parts.join('\n'), type: 'b' };
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node tools/migrate-type-b.js <presentation-name>');
    console.error('Example: node tools/migrate-type-b.js claudinglab-anthropic-meetup');
    process.exit(1);
  }

  const presentationName = args[0];
  const presentationsRoot = loadPresentationsRoot();
  const sourceDir = path.join(presentationsRoot, presentationName);
  const outputDir = path.join(presentationsRoot, `${presentationName}-v2`);

  if (!fs.existsSync(sourceDir)) {
    console.error(`Error: source presentation not found: ${sourceDir}`);
    process.exit(1);
  }
  if (!fs.statSync(sourceDir).isDirectory()) {
    console.error(`Error: not a directory: ${sourceDir}`);
    process.exit(1);
  }

  const htmlFiles = fs
    .readdirSync(sourceDir)
    .filter((f) => f.toLowerCase().endsWith('.html'))
    .sort();

  if (htmlFiles.length === 0) {
    console.log(`No .html files found in ${sourceDir}`);
    process.exit(0);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const results = {
    migratedA: [],
    migratedB: [],
    skipped: [],
    typeC: [],
  };

  console.log(`\nFliDeck Type B Migration`);
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

    const result = extractFragmentTypeB(html, filename);

    if (result.skip) {
      console.log(`  SKIP     ${filename} — ${result.reason}`);
      results.skipped.push({ filename, reason: result.reason });
      continue;
    }

    if (result.typeC) {
      console.log(`  TYPE-C   ${filename} — ${result.reason}`);
      results.typeC.push({ filename, reason: result.reason });
      // Write the original file with a warning comment prepended; do not strip wrapper
      const warning = `<!-- WARNING: harness-migration-skip: type-c — ${result.reason} -->\n`;
      fs.writeFileSync(dstPath, warning + html, 'utf8');
      continue;
    }

    fs.writeFileSync(dstPath, result.fragment, 'utf8');

    if (result.type === 'b') {
      console.log(`  TYPE-B   ${filename}`);
      results.migratedB.push(filename);
    } else {
      console.log(`  TYPE-A   ${filename}`);
      results.migratedA.push(filename);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────');
  console.log(`Summary for "${presentationName}":`);
  console.log(`  Migrated Type A : ${results.migratedA.length} (pure HTML/CSS, no script)`);
  console.log(`  Migrated Type B : ${results.migratedB.length} (known-safe JS patterns handled)`);
  console.log(`  Skipped         : ${results.skipped.length} (already migrated or empty)`);
  console.log(`  Flagged Type C  : ${results.typeC.length} (complex JS — manual review needed)`);

  if (results.typeC.length > 0) {
    console.log('\nType C files (not migrated — warning comment added to output):');
    for (const { filename, reason } of results.typeC) {
      console.log(`  ! ${filename}`);
      console.log(`      ${reason}`);
    }
  }

  if (results.migratedB.length > 0) {
    console.log('\nType B files migrated (JS patterns handled):');
    for (const filename of results.migratedB) {
      console.log(`  + ${filename}`);
    }
  }

  if (results.migratedA.length + results.migratedB.length > 0) {
    console.log(`\nOutput written to: ${outputDir}`);
  }

  console.log('─────────────────────────────────────────────────\n');
}

main();
