#!/usr/bin/env node
'use strict';

/**
 * Kannada Font Quality Inspector — CLI
 *
 * Usage:
 *   node index.js font.ttf                              Analyze a single font
 *   node index.js fonts/                                Analyze all fonts in a directory
 *   node index.js font.ttf --compare old.json           Compare against a previous report (version diff)
 *   node index.js fontA.ttf --compare-font fontB.ttf   Cross-font comparison: why does B render better?
 *   node index.js font.ttf --out reports/               Save report to a custom folder
 *   node index.js font.ttf --json                       Print JSON report to stdout
 *   node index.js font.ttf --no-html                    Skip HTML report generation
 */

const fs   = require('fs');
const path = require('path');

const { analyzeFont, compareReports, compareFont } = require('./src/analyzer');
const { renderHtmlReport, renderComparisonReport }  = require('./src/reporter');

// ─── CLI argument parsing ────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const flags   = {};
const positional = [];

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--json')            { flags.json        = true; }
  else if (a === '--no-html')    { flags.noHtml      = true; }
  else if (a === '--compare')    { flags.compare     = args[++i]; }
  else if (a === '--compare-font') { flags.compareFont = args[++i]; }
  else if (a === '--out')        { flags.out         = args[++i]; }
  else if (!a.startsWith('-'))   { positional.push(a); }
}

if (positional.length === 0) {
  console.error(`
Kannada Font Quality Inspector
Usage:
  node index.js <font.ttf|otf|directory>  [options]

Options:
  --compare <old.json>        Version diff: compare current run against a saved JSON report of the same font
  --compare-font <font2.ttf>  Cross-font analysis: compare Font A's internals against a stronger Font B
  --out <dir>                 Output directory for reports (default: ./reports)
  --json                      Print JSON to stdout instead of saving HTML
  --no-html                   Skip HTML report, save only JSON

Examples:
  node index.js KarnataGTN-Regular.ttf
  node index.js fonts/
  node index.js KarnataGTN-Regular.ttf --compare-font fonts/NotoSansKannada.ttf
  node index.js KarnataGTN-Bold.ttf --compare reports/KarnataGTN-Regular_2024-01-01.json
`);
  process.exit(1);
}

// ─── Cross-font comparison mode ──────────────────────────────────────────────
// When --compare-font is given, run the full internals diff and exit early.

if (flags.compareFont) {
  const fontPathA = path.resolve(positional[0]);
  const fontPathB = path.resolve(flags.compareFont);

  if (!fs.existsSync(fontPathA)) {
    console.error(`Font A not found: ${fontPathA}`);
    process.exit(1);
  }
  if (!fs.existsSync(fontPathB)) {
    console.error(`Font B not found: ${fontPathB}`);
    process.exit(1);
  }

  const nameA = path.basename(fontPathA);
  const nameB = path.basename(fontPathB);

  console.log(`\n🔬 Cross-Font Comparison`);
  console.log(`   Font A (to fix):     ${nameA}`);
  console.log(`   Font B (reference):  ${nameB}`);

  let comparison;
  try {
    comparison = compareFont(fontPathA, fontPathB);
  } catch (err) {
    console.error(`  ✗ Comparison failed: ${err.message}`);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  }

  const { diff } = comparison;
  const rA = comparison.fontA.report;
  const rB = comparison.fontB.report;

  // Print CLI summary
  console.log(`\n  Scores:  A = ${rA.score.total}/100 (Grade ${rA.score.grade}) · B = ${rB.score.total}/100 (Grade ${rB.score.grade})`);
  console.log(`  Score gap: ${diff.scoreDelta > 0 ? '+' : ''}${diff.scoreDelta} pts`);
  console.log(`  GSUB features only in B: ${(diff.gsub.onlyInB || []).join(', ') || 'none'}`);
  console.log(`  Glyphs in B missing from A: ${(diff.coverage.onlyInB || []).length}`);
  console.log(`\n  Fix Plan (${diff.fixPlan.length} action(s)):`);
  for (const item of diff.fixPlan) {
    const icon = { critical: '⛔', warning: '⚠️', info: 'ℹ️' }[item.severity] || '•';
    console.log(`    ${icon} [${item.category}] ${item.action}`);
  }

  if (flags.json) {
    process.stdout.write(JSON.stringify(comparison, null, 2));
    process.exit(0);
  }

  // Save comparison report
  const outDir = path.resolve(flags.out || 'reports');
  fs.mkdirSync(outDir, { recursive: true });

  const ts       = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const baseName = `compare_${path.basename(fontPathA, path.extname(fontPathA))}_vs_${path.basename(fontPathB, path.extname(fontPathB))}`;
  const stamp    = `${baseName}_${ts}`;

  // Save JSON
  const jsonPath = path.join(outDir, `${stamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(comparison, null, 2), 'utf8');
  console.log(`\n  📄 JSON:  ${jsonPath}`);

  // Save HTML comparison report
  if (!flags.noHtml) {
    const htmlPath = path.join(outDir, `${stamp}.html`);
    const html = renderComparisonReport(comparison);
    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log(`  📊 HTML:  ${htmlPath}`);

    // Also save a "latest" copy
    const latestHtmlPath = path.join(outDir, `${baseName}_latest.html`);
    const latestJsonPath = path.join(outDir, `${baseName}_latest.json`);
    fs.writeFileSync(latestHtmlPath, html, 'utf8');
    fs.writeFileSync(latestJsonPath, JSON.stringify(comparison, null, 2), 'utf8');
    console.log(`  🔗 Latest: ${latestHtmlPath}`);
  }

  process.exit(0);
}

// ─── Resolve font files ──────────────────────────────────────────────────────

const FONT_EXTS = new Set(['.ttf', '.otf', '.woff']);

function resolveFontFiles(input) {
  const abs = path.resolve(input);
  const stat = fs.statSync(abs);
  if (stat.isDirectory()) {
    return fs.readdirSync(abs)
      .filter(f => FONT_EXTS.has(path.extname(f).toLowerCase()))
      .map(f => path.join(abs, f));
  }
  return [abs];
}

// ─── Output directory ────────────────────────────────────────────────────────

const outDir = path.resolve(flags.out || 'reports');
if (!flags.json) {
  fs.mkdirSync(outDir, { recursive: true });
}

// ─── Process fonts ───────────────────────────────────────────────────────────

const fontFiles = resolveFontFiles(positional[0]);

if (fontFiles.length === 0) {
  console.error('No font files found.');
  process.exit(1);
}

for (const fontPath of fontFiles) {
  console.log(`\n🔍 Analyzing: ${path.basename(fontPath)}`);

  let report;
  try {
    report = analyzeFont(fontPath);
  } catch (err) {
    console.error(`  ✗ Failed to analyze: ${err.message}`);
    continue;
  }

  // Compare against previous report if --compare is given
  let diff = null;
  if (flags.compare) {
    try {
      const oldReport = JSON.parse(fs.readFileSync(path.resolve(flags.compare), 'utf8'));
      diff = compareReports(oldReport, report);
      console.log(`  ↔  Comparing against: ${path.basename(flags.compare)}`);
      console.log(`     Score delta: ${diff.scoreDelta > 0 ? '+' : ''}${diff.scoreDelta} pts`);
      console.log(`     Glyphs added: ${diff.coverage.added.length}, removed: ${diff.coverage.removed.length}`);
      console.log(`     Issues resolved: ${diff.issues.resolved.length}, introduced: ${diff.issues.introduced.length}`);
    } catch (err) {
      console.warn(`  ⚠  Could not load comparison report: ${err.message}`);
    }
  }

  // Print summary
  const { score, issues, coverage, features } = report;
  console.log(`  Score: ${score.total}/100 (Grade ${score.grade})`);
  console.log(`  Coverage: ${coverage.stats.requiredPresent}/${coverage.stats.requiredTotal} required · ${coverage.stats.revivalPresent}/${coverage.stats.revivalTotal} revival`);
  console.log(`  Features: ${features.stats.requiredPresent}/${features.stats.requiredTotal} required`);
  const errs  = issues.filter(i => i.severity === 'error').length;
  const warns = issues.filter(i => i.severity === 'warning').length;
  if (errs > 0)  console.log(`  ⛔ ${errs} error(s)`);
  if (warns > 0) console.log(`  ⚠  ${warns} warning(s)`);
  if (errs === 0 && warns === 0) console.log('  ✓ No critical issues');

  // Output JSON
  if (flags.json) {
    process.stdout.write(JSON.stringify(report, null, 2));
    continue;
  }

  const baseName = path.basename(fontPath, path.extname(fontPath));
  const ts       = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const stamp    = `${baseName}_${ts}`;

  // Save JSON report
  const jsonPath = path.join(outDir, `${stamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`  📄 JSON: ${jsonPath}`);

  // Save HTML report
  if (!flags.noHtml) {
    const htmlPath = path.join(outDir, `${stamp}.html`);
    const html     = renderHtmlReport(report, diff);
    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log(`  📊 HTML: ${htmlPath}`);

    // Also save a "latest" symlink/copy
    const latestJsonPath = path.join(outDir, `${baseName}_latest.json`);
    const latestHtmlPath = path.join(outDir, `${baseName}_latest.html`);
    fs.writeFileSync(latestJsonPath, JSON.stringify(report, null, 2), 'utf8');
    fs.writeFileSync(latestHtmlPath, html, 'utf8');
    console.log(`  🔗 Latest: ${latestHtmlPath}`);
  }
}

// ─── Batch summary ───────────────────────────────────────────────────────────

if (fontFiles.length > 1) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Analyzed ${fontFiles.length} font(s). Reports saved to: ${outDir}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
