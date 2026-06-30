'use strict';

/**
 * HTML report generator for Kannada font quality reports.
 * Takes the structured analysis object and renders a self-contained HTML report.
 */

function renderHtmlReport(report, diff = null) {
  const { score, issues, metadata, coverage, scripts, features, gsub, gpos, glyphs, meta } = report;

  const gradeColor = {
    A: '#16a34a', B: '#2563eb', C: '#d97706', D: '#ea580c', F: '#dc2626'
  }[score.grade] || '#64748b';

  const errCount  = issues.filter(i => i.severity === 'error').length;
  const warnCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  const fontName = metadata.fields.fullName?.value
    || metadata.fields.fontFamily?.value
    || meta.fontFile;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Font QA Report — ${esc(fontName)}</title>
<style>
  :root {
    --bg: #ffffff; --surface: #f8fafc; --border: #e2e8f0;
    --text: #0f172a; --muted: #64748b;
    --pass: #16a34a; --fail: #dc2626; --warn: #d97706; --info: #2563eb;
    --pass-bg: #dcfce7; --fail-bg: #fee2e2; --warn-bg: #fef9c3; --info-bg: #dbeafe;
    --radius: 8px; --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: var(--font); background: var(--bg); color: var(--text); font-size: 14px; line-height: 1.6; }

  header { background: #0f172a; color: #fff; padding: 16px 32px; display: flex; align-items: center; gap: 16px; }
  header img { height: 32px; }
  header .title { font-size: 18px; font-weight: 600; }
  header .sub { font-size: 12px; color: #94a3b8; }

  .container { max-width: 1100px; margin: 0 auto; padding: 24px 32px; }

  .score-card { display: grid; grid-template-columns: auto 1fr auto; gap: 24px; align-items: center;
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 24px; margin-bottom: 24px; }
  .score-circle { width: 96px; height: 96px; border-radius: 50%; border: 6px solid ${gradeColor};
    display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; }
  .score-num { font-size: 28px; font-weight: 700; color: ${gradeColor}; line-height: 1; }
  .score-grade { font-size: 14px; font-weight: 600; color: ${gradeColor}; }
  .score-meta h2 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
  .score-meta .ts { font-size: 11px; color: var(--muted); }
  .score-breakdown { display: flex; flex-direction: column; gap: 6px; min-width: 200px; }
  .score-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .score-label { font-size: 12px; color: var(--muted); }
  .score-bar-wrap { flex: 1; background: var(--border); border-radius: 4px; height: 6px; overflow: hidden; }
  .score-bar { height: 100%; border-radius: 4px; background: ${gradeColor}; }
  .score-val { font-size: 12px; font-weight: 600; min-width: 32px; text-align: right; }

  .issue-bar { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
  .badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px;
    border-radius: 20px; font-size: 13px; font-weight: 600; }
  .badge-error { background: var(--fail-bg); color: var(--fail); }
  .badge-warning { background: var(--warn-bg); color: var(--warn); }
  .badge-info { background: var(--info-bg); color: var(--info); }
  .badge-ok { background: var(--pass-bg); color: var(--pass); }

  .section { margin-bottom: 32px; }
  .section-title { font-size: 16px; font-weight: 700; color: var(--text);
    padding-bottom: 8px; border-bottom: 2px solid var(--border); margin-bottom: 16px;
    display: flex; align-items: center; gap: 8px; }
  .section-title .tag { font-size: 11px; font-weight: 500; color: var(--muted);
    background: var(--border); padding: 2px 8px; border-radius: 10px; }

  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: var(--surface); text-align: left; padding: 8px 12px; font-size: 11px;
       font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted);
       border-bottom: 2px solid var(--border); }
  td { padding: 8px 12px; border-bottom: 1px solid var(--border); vertical-align: top; }
  tr:hover td { background: var(--surface); }

  .pill { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
  .pill-pass { background: var(--pass-bg); color: var(--pass); }
  .pill-fail { background: var(--fail-bg); color: var(--fail); }
  .pill-warn { background: var(--warn-bg); color: var(--warn); }
  .pill-info { background: var(--info-bg); color: var(--info); }

  .glyph-grid { display: flex; flex-wrap: wrap; gap: 4px; }
  .glyph-cell { width: 56px; height: 56px; border: 1px solid var(--border); border-radius: 6px;
    display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; }
  .glyph-cell.present { background: var(--pass-bg); border-color: #86efac; }
  .glyph-cell.missing { background: var(--fail-bg); border-color: #fca5a5; }
  .glyph-cell.revival { border-style: dashed; }
  .glyph-char { font-size: 22px; line-height: 1; }
  .glyph-cp { font-size: 9px; color: var(--muted); }
  .glyph-cell .tooltip { display: none; position: absolute; bottom: calc(100% + 4px); left: 50%;
    transform: translateX(-50%); background: #1e293b; color: #fff; font-size: 11px;
    padding: 4px 8px; border-radius: 4px; white-space: nowrap; z-index: 10; }
  .glyph-cell:hover .tooltip { display: block; }

  .feature-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 8px; }
  .feature-item { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px;
    border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); }
  .feature-icon { width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0; margin-top: 2px;
    display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
  .feature-icon.pass { background: var(--pass); color: #fff; }
  .feature-icon.fail { background: var(--fail); color: #fff; }
  .feature-tag { font-family: monospace; font-size: 13px; font-weight: 700; }
  .feature-name { font-size: 12px; font-weight: 600; }
  .feature-desc { font-size: 11px; color: var(--muted); margin-top: 2px; }
  .feature-lookup { font-size: 11px; color: var(--pass); }

  .issue-list { display: flex; flex-direction: column; gap: 8px; }
  .issue-item { display: flex; gap: 10px; align-items: flex-start; padding: 10px 14px;
    border-radius: var(--radius); border: 1px solid var(--border); }
  .issue-item.error  { background: var(--fail-bg); border-color: #fca5a5; }
  .issue-item.warning { background: var(--warn-bg); border-color: #fcd34d; }
  .issue-item.info   { background: var(--info-bg); border-color: #93c5fd; }
  .issue-icon { font-size: 16px; flex-shrink: 0; }
  .issue-body .issue-cat { font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--muted); }
  .issue-body .issue-msg { font-size: 13px; margin-top: 2px; }

  .lookup-row td:nth-child(2) { font-family: monospace; font-size: 12px; }
  .stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
  .stat-box { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 14px; text-align: center; }
  .stat-num { font-size: 28px; font-weight: 700; color: var(--text); }
  .stat-label { font-size: 11px; color: var(--muted); margin-top: 4px; }

  ${diff ? `.diff-section { background: #f0fdf4; border: 1px solid #86efac; border-radius: var(--radius);
    padding: 16px 20px; margin-bottom: 24px; }
  .diff-title { font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  .delta { font-size: 13px; font-weight: 700; }
  .delta.pos { color: var(--pass); } .delta.neg { color: var(--fail); } .delta.neu { color: var(--muted); }` : ''}

  .cat-label { font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase;
    letter-spacing: 0.06em; margin: 12px 0 6px; }

  code { font-family: monospace; background: var(--surface); border: 1px solid var(--border);
    padding: 1px 5px; border-radius: 4px; font-size: 12px; }

  footer { text-align: center; padding: 24px; color: var(--muted); font-size: 12px;
    border-top: 1px solid var(--border); margin-top: 40px; }
</style>
</head>
<body>

<header>
  <div>
    <div class="title">ಕನ್ನಡ Font Quality Inspector</div>
    <div class="sub">Sanchaya Font Tools · typetest.sanchaya.net</div>
  </div>
</header>

<div class="container">

  <!-- Score Card -->
  <div class="score-card">
    <div class="score-circle">
      <div class="score-num">${score.total}</div>
      <div class="score-grade">Grade ${score.grade}</div>
    </div>
    <div class="score-meta">
      <h2>${esc(fontName)}</h2>
      <div class="ts">Analyzed ${formatDate(meta.timestamp)} · ${esc(meta.fontFile)}</div>
      <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
        ${errCount  > 0 ? `<span class="badge badge-error">⛔ ${errCount} Error${errCount>1?'s':''}</span>` : ''}
        ${warnCount > 0 ? `<span class="badge badge-warning">⚠️ ${warnCount} Warning${warnCount>1?'s':''}</span>` : ''}
        ${infoCount > 0 ? `<span class="badge badge-info">ℹ️ ${infoCount} Info</span>` : ''}
        ${errCount === 0 && warnCount === 0 ? `<span class="badge badge-ok">✓ No critical issues</span>` : ''}
      </div>
    </div>
    <div class="score-breakdown">
      ${scoreRow('Unicode Coverage', score.breakdown.coverage, 40)}
      ${scoreRow('OpenType Features', score.breakdown.features, 30)}
      ${scoreRow('Script Tables', score.breakdown.scripts, 10)}
      ${scoreRow('Metadata', score.breakdown.metadata, 10)}
      ${scoreRow('Revival/Archaic', score.breakdown.revival, 10)}
    </div>
  </div>

  ${diff ? renderDiffSection(diff) : ''}

  <!-- Issues -->
  <div class="section">
    <div class="section-title">Issues <span class="tag">${issues.length} total</span></div>
    ${issues.length === 0
      ? `<div class="badge badge-ok" style="display:inline-flex">✓ No issues found — this font passes all checks</div>`
      : `<div class="issue-list">${issues.map(renderIssue).join('')}</div>`}
  </div>

  <!-- Unicode Coverage -->
  <div class="section">
    <div class="section-title">Kannada Unicode Coverage
      <span class="tag">${coverage.stats.present}/${coverage.stats.total} present</span>
      <span class="tag" style="color:${coverage.stats.requiredMissing>0?'var(--fail)':'var(--pass)'}">
        Required: ${coverage.stats.requiredPresent}/${coverage.stats.requiredTotal}
      </span>
    </div>
    <div class="stat-grid" style="margin-bottom:20px">
      ${statBox(coverage.stats.present, 'Glyphs Present')}
      ${statBox(coverage.stats.missing, 'Glyphs Missing')}
      ${statBox(coverage.stats.requiredPresent, 'Required Present')}
      ${statBox(coverage.stats.requiredMissing, 'Required Missing')}
      ${statBox(coverage.stats.revivalPresent, 'Revival Present')}
      ${statBox(coverage.stats.revivalTotal - coverage.stats.revivalPresent, 'Revival Missing')}
    </div>
    ${renderCoverageGrid(coverage)}
  </div>

  <!-- OpenType Features -->
  <div class="section">
    <div class="section-title">OpenType Feature Coverage
      <span class="tag">${features.stats.requiredPresent}/${features.stats.requiredTotal} required present</span>
    </div>
    <div style="font-size:12px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; margin-bottom:8px;">Required Features</div>
    <div class="feature-grid" style="margin-bottom:20px">
      ${features.required.map(renderFeatureItem).join('')}
    </div>
    <div style="font-size:12px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; margin-bottom:8px;">Recommended / Optional Features</div>
    <div class="feature-grid">
      ${features.recommended.map(renderFeatureItem).join('')}
    </div>
  </div>

  <!-- Script Support -->
  <div class="section">
    <div class="section-title">Script & Language Tables</div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px;">
      ${renderScriptTable('GSUB Script Records', scripts.gsub)}
      ${renderScriptTable('GPOS Script Records', scripts.gpos)}
    </div>
    <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
      <span class="pill ${scripts.hasKannadaScript ? 'pill-pass' : 'pill-fail'}">
        ${scripts.hasKannadaScript ? '✓' : '✗'} knda Script Record
      </span>
      <span class="pill ${scripts.hasDFLT ? 'pill-pass' : 'pill-warn'}">
        ${scripts.hasDFLT ? '✓' : '!'} DFLT Script Record
      </span>
      <span class="pill ${gpos.present ? 'pill-pass' : 'pill-fail'}">
        ${gpos.present ? '✓' : '✗'} GPOS Table
      </span>
      <span class="pill ${gpos.hasMarkPos ? 'pill-pass' : 'pill-fail'}">
        ${gpos.hasMarkPos ? '✓' : '✗'} Mark-to-Base Positioning
      </span>
      <span class="pill ${gpos.hasMkmk ? 'pill-pass' : 'pill-warn'}">
        ${gpos.hasMkmk ? '✓' : '!'} Mark-to-Mark
      </span>
    </div>
  </div>

  <!-- GSUB Analysis -->
  <div class="section">
    <div class="section-title">GSUB — Substitution Rules
      <span class="tag">${gsub.present ? gsub.lookupCount + ' lookups · ' + gsub.totalRules + ' rules' : 'No GSUB table'}</span>
    </div>
    ${!gsub.present ? '<p style="color:var(--fail)">No GSUB table found.</p>' : `
    <div class="stat-grid" style="margin-bottom:20px">
      ${statBox(gsub.lookupCount, 'Total Lookups')}
      ${statBox(gsub.totalRules, 'Total Rules')}
      ${statBox(Object.keys(gsub.typeBreakdown).length, 'Lookup Types')}
      ${statBox((gsub.featureRecords||[]).length, 'Feature Records')}
    </div>
    <table>
      <thead><tr><th>#</th><th>Type</th><th>Subtables</th><th>Rules</th></tr></thead>
      <tbody class="lookup-row">
        ${(gsub.lookups||[]).slice(0, 80).map(l =>
          `<tr><td>${l.index}</td><td>${esc(l.typeName)}</td><td>${l.subtableCount}</td><td>${l.ruleCount}</td></tr>`
        ).join('')}
        ${(gsub.lookups||[]).length > 80 ? `<tr><td colspan="4" style="color:var(--muted); text-align:center">…and ${gsub.lookups.length - 80} more</td></tr>` : ''}
      </tbody>
    </table>
    <div style="margin-top:16px">
      <table>
        <thead><tr><th>Feature</th><th>Lookup Indices</th></tr></thead>
        <tbody>
          ${Object.entries(gsub.featureToLookups||{}).slice(0, 30).map(([tag, idxs]) =>
            `<tr><td><code>${esc(tag)}</code></td><td style="font-family:monospace;font-size:12px">${idxs.join(', ')}</td></tr>`
          ).join('')}
        </tbody>
      </table>
    </div>
    `}
  </div>

  <!-- GPOS Analysis -->
  <div class="section">
    <div class="section-title">GPOS — Positioning Rules
      <span class="tag">${gpos.present ? gpos.lookupCount + ' lookups · ' + gpos.markAnchorCount + ' mark anchors' : 'No GPOS table'}</span>
    </div>
    ${!gpos.present ? '<p style="color:var(--fail)">No GPOS table found.</p>' : `
    <div class="stat-grid" style="margin-bottom:20px">
      ${statBox(gpos.lookupCount, 'Total Lookups')}
      ${statBox(gpos.markAnchorCount, 'Mark Anchors')}
      ${statBox(Object.keys(gpos.typeBreakdown).length, 'Lookup Types')}
      ${statBox((gpos.featureRecords||[]).length, 'Feature Records')}
    </div>
    <table>
      <thead><tr><th>#</th><th>Type</th><th>Subtables</th></tr></thead>
      <tbody class="lookup-row">
        ${(gpos.lookups||[]).map(l =>
          `<tr><td>${l.index}</td><td>${esc(l.typeName)}</td><td>${l.subtableCount}</td></tr>`
        ).join('')}
      </tbody>
    </table>
    `}
  </div>

  <!-- Metadata -->
  <div class="section">
    <div class="section-title">Font Metadata</div>
    <table>
      <thead><tr><th>Field</th><th>Value</th><th>Status</th></tr></thead>
      <tbody>
        ${Object.values(metadata.fields).map(f =>
          `<tr><td>${esc(f.label)}</td><td>${f.value ? esc(f.value) : '<span style="color:var(--muted)">—</span>'}</td>
           <td><span class="pill ${f.present ? 'pill-pass' : 'pill-warn'}">${f.present ? '✓ Present' : '! Missing'}</span></td></tr>`
        ).join('')}
      </tbody>
    </table>
    ${metadata.os2 ? `
    <div style="margin-top:20px">
      <div class="cat-label">OS/2 Table</div>
      <table>
        <thead><tr><th>Property</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>Units Per Em</td><td>${metadata.head?.unitsPerEm ?? '—'}</td></tr>
          <tr><td>Weight Class</td><td>${metadata.os2.weightClass}</td></tr>
          <tr><td>Width Class</td><td>${metadata.os2.widthClass}</td></tr>
          <tr><td>Typo Ascender</td><td>${metadata.os2.typoAscender}</td></tr>
          <tr><td>Typo Descender</td><td>${metadata.os2.typoDescender}</td></tr>
          <tr><td>Cap Height</td><td>${metadata.os2.capHeight ?? '—'}</td></tr>
          <tr><td>x Height</td><td>${metadata.os2.xHeight ?? '—'}</td></tr>
          <tr><td>Kannada Unicode Range (bit 25)</td>
            <td><span class="pill ${metadata.os2.unicodeRanges.hasKannada ? 'pill-pass' : 'pill-fail'}">
              ${metadata.os2.unicodeRanges.hasKannada ? '✓ Set' : '✗ Not set'}</span></td></tr>
          <tr><td>Declared Unicode Ranges</td><td>${metadata.os2.unicodeRanges.declaredRanges.join(', ') || '—'}</td></tr>
          <tr><td>Italic Angle</td><td>${metadata.post?.italicAngle ?? '—'}</td></tr>
        </tbody>
      </table>
    </div>` : ''}
  </div>

  <!-- Glyph Stats -->
  <div class="section">
    <div class="section-title">Glyph Inventory
      <span class="tag">${glyphs.total} total · ${glyphs.kannadaCount} Kannada</span>
    </div>
    <div class="stat-grid" style="margin-bottom:20px">
      ${statBox(glyphs.total, 'Total Glyphs')}
      ${statBox(glyphs.kannadaCount, 'Kannada Glyphs')}
      ${statBox(glyphs.emptyCount, 'Empty Glyphs')}
      ${statBox(glyphs.unitsPerEm, 'Units Per Em')}
      ${glyphs.advanceStats ? statBox(glyphs.advanceStats.median, 'Median Advance Width') : ''}
      ${glyphs.advanceStats ? statBox(glyphs.advanceStats.outliers.length, 'Width Outliers') : ''}
    </div>
    ${glyphs.emptyCount > 0 ? `
    <div class="cat-label">Empty Glyphs (no path data)</div>
    <table>
      <thead><tr><th>Index</th><th>Name</th><th>Unicode</th><th>Advance Width</th></tr></thead>
      <tbody>
        ${glyphs.emptyGlyphs.slice(0, 30).map(g =>
          `<tr><td>${g.index}</td><td><code>${esc(g.name)}</code></td>
           <td>${g.unicodes.join(', ')}</td><td>${g.advanceWidth ?? '—'}</td></tr>`
        ).join('')}
        ${glyphs.emptyGlyphs.length > 30 ? `<tr><td colspan="4" style="color:var(--muted)">…and ${glyphs.emptyGlyphs.length - 30} more</td></tr>` : ''}
      </tbody>
    </table>` : ''}
  </div>

</div>

<footer>
  Generated by Kannada Font Quality Inspector v${meta.version} ·
  <a href="https://typetest.sanchaya.net" style="color:var(--muted)">typetest.sanchaya.net</a> ·
  ${formatDate(meta.timestamp)}
</footer>
</body>
</html>`;
}

// ─── Diff Section ─────────────────────────────────────────────────────────────

function renderDiffSection(diff) {
  const delta = diff.scoreDelta;
  const deltaClass = delta > 0 ? 'pos' : delta < 0 ? 'neg' : 'neu';
  const deltaSign  = delta > 0 ? '+' : '';

  return `<div class="diff-section">
    <div class="diff-title">📊 Comparison with Previous Version
      <span class="delta ${deltaClass}">${deltaSign}${delta} pts (${diff.old.score} → ${diff.new.score})</span>
    </div>
    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px; font-size:13px;">
      <div>
        <div style="font-weight:700; margin-bottom:6px; color:var(--pass)">✓ Glyphs Added (${diff.coverage.added.length})</div>
        ${diff.coverage.added.slice(0,10).map(r => `<div>${r.char} ${r.cpHex} ${r.name}</div>`).join('') || '<div style="color:var(--muted)">None</div>'}
      </div>
      <div>
        <div style="font-weight:700; margin-bottom:6px; color:var(--fail)">✗ Glyphs Removed (${diff.coverage.removed.length})</div>
        ${diff.coverage.removed.slice(0,10).map(r => `<div>${r.char} ${r.cpHex} ${r.name}</div>`).join('') || '<div style="color:var(--muted)">None</div>'}
      </div>
      <div>
        <div style="font-weight:700; margin-bottom:6px; color:var(--pass)">✓ Issues Resolved (${diff.issues.resolved.length})</div>
        ${diff.issues.resolved.slice(0,5).map(i => `<div style="font-size:11px">${esc(i.message)}</div>`).join('') || '<div style="color:var(--muted)">None</div>'}
        <div style="font-weight:700; margin:8px 0 6px; color:var(--fail)">✗ Issues Introduced (${diff.issues.introduced.length})</div>
        ${diff.issues.introduced.slice(0,5).map(i => `<div style="font-size:11px">${esc(i.message)}</div>`).join('') || '<div style="color:var(--muted)">None</div>'}
      </div>
    </div>
    <div style="margin-top:12px; font-size:12px; color:var(--muted)">
      Previous: ${esc(diff.old.file)} (${formatDate(diff.old.timestamp)}) &nbsp;→&nbsp;
      Current: ${esc(diff.new.file)} (${formatDate(diff.new.timestamp)})
    </div>
  </div>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreRow(label, val, max) {
  const pct = Math.round((val / max) * 100);
  return `<div class="score-row">
    <span class="score-label">${label}</span>
    <div class="score-bar-wrap"><div class="score-bar" style="width:${pct}%"></div></div>
    <span class="score-val">${val}/${max}</span>
  </div>`;
}

function statBox(num, label) {
  return `<div class="stat-box"><div class="stat-num">${num ?? '—'}</div><div class="stat-label">${label}</div></div>`;
}

function renderIssue(issue) {
  const icons = { error: '⛔', warning: '⚠️', info: 'ℹ️' };
  return `<div class="issue-item ${issue.severity}">
    <span class="issue-icon">${icons[issue.severity] || '•'}</span>
    <div class="issue-body">
      <div class="issue-cat">${esc(issue.category)}</div>
      <div class="issue-msg">${esc(issue.message)}</div>
    </div>
  </div>`;
}

function renderFeatureItem(f) {
  const ok = f.present;
  return `<div class="feature-item">
    <div class="feature-icon ${ok ? 'pass' : 'fail'}">${ok ? '✓' : '✗'}</div>
    <div>
      <div><span class="feature-tag">${esc(f.tag)}</span></div>
      <div class="feature-name">${esc(f.name)}</div>
      <div class="feature-desc">${esc(f.desc)}</div>
      ${ok ? `<div class="feature-lookup">↳ ${f.lookupCount} lookup(s)</div>` : ''}
    </div>
  </div>`;
}

function renderCoverageGrid(coverage) {
  const cats = {
    vowel:     'Independent Vowels',
    consonant: 'Consonants',
    matra:     'Dependent Vowel Signs (Matras)',
    sign:      'Signs & Diacritics',
    digit:     'Digits',
  };

  return Object.entries(cats).map(([cat, label]) => {
    const items = coverage.byCategory[cat] || [];
    if (items.length === 0) return '';
    return `<div class="cat-label">${label}</div>
    <div class="glyph-grid" style="margin-bottom:16px">
      ${items.map(r => `
        <div class="glyph-cell ${r.hasGlyph ? 'present' : 'missing'} ${r.revival ? 'revival' : ''}">
          <div class="glyph-char">${r.char}</div>
          <div class="glyph-cp">${r.cpHex}</div>
          <div class="tooltip">${esc(r.name)}${r.revival ? ' (revival)' : ''}</div>
        </div>`).join('')}
    </div>`;
  }).join('');
}

function renderScriptTable(title, records) {
  return `<div>
    <div class="cat-label">${title}</div>
    <table>
      <thead><tr><th>Tag</th><th>Default LangSys</th><th>Lang Systems</th></tr></thead>
      <tbody>
        ${records.length === 0 ? '<tr><td colspan="3" style="color:var(--muted)">None</td></tr>'
          : records.map(r => `<tr>
            <td><code>${esc(r.tag)}</code></td>
            <td><span class="pill ${r.defaultLangSys ? 'pill-pass' : 'pill-warn'}">${r.defaultLangSys ? '✓' : '✗'}</span></td>
            <td>${r.langSystems.join(', ') || '—'}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Cross-Font Comparison Report ─────────────────────────────────────────────

/**
 * Render a self-contained HTML comparison report for two fonts.
 * @param {object} comparison  Return value of compareFont()
 */
function renderComparisonReport(comparison) {
  const { diff, fontA, fontB, meta } = comparison;
  const rA = fontA.report;
  const rB = fontB.report;

  const nameA = rA.metadata.fields.fullName?.value || rA.metadata.fields.fontFamily?.value || rA.meta.fontFile;
  const nameB = rB.metadata.fields.fullName?.value || rB.metadata.fields.fontFamily?.value || rB.meta.fontFile;

  const gradeColorA = gradeColor(rA.score.grade);
  const gradeColorB = gradeColor(rB.score.grade);

  const { OT_FEATURES } = require('./kannada-data');
  const requiredTags = new Set(OT_FEATURES.filter(f => f.required).map(f => f.tag));
  const featureDesc  = Object.fromEntries(OT_FEATURES.map(f => [f.tag, { name: f.name, desc: f.desc }]));

  // Severity icon helper
  function sevIcon(sev) {
    return { critical: '⛔', warning: '⚠️', info: 'ℹ️' }[sev] || '•';
  }
  function sevClass(sev) {
    return { critical: 'error', warning: 'warning', info: 'info' }[sev] || 'info';
  }

  // Build GSUB combined feature tag list
  const allGsubTags = [...new Set([
    ...Object.keys(diff.gsub.shared || {}),
    ...(diff.gsub.onlyInA || []),
    ...(diff.gsub.onlyInB || []),
    ...OT_FEATURES.filter(f => f.stage < 3).map(f => f.tag),
  ])].sort();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Font Comparison — ${esc(nameA)} vs ${esc(nameB)}</title>
<style>
  :root {
    --bg: #ffffff; --surface: #f8fafc; --border: #e2e8f0;
    --text: #0f172a; --muted: #64748b;
    --pass: #16a34a; --fail: #dc2626; --warn: #d97706; --info: #2563eb;
    --pass-bg: #dcfce7; --fail-bg: #fee2e2; --warn-bg: #fef9c3; --info-bg: #dbeafe;
    --a: #2563eb; --b: #9333ea;
    --a-bg: #dbeafe; --b-bg: #f3e8ff;
    --radius: 8px; --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: var(--font); background: var(--bg); color: var(--text); font-size: 14px; line-height: 1.6; }

  header { background: #0f172a; color: #fff; padding: 16px 32px; }
  header .title { font-size: 18px; font-weight: 700; }
  header .sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }

  .container { max-width: 1160px; margin: 0 auto; padding: 24px 32px; }

  /* Hero comparison cards */
  .hero { display: grid; grid-template-columns: 1fr 56px 1fr; gap: 0; align-items: stretch; margin-bottom: 28px; }
  .hero-vs { display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--muted); font-size: 18px; }
  .font-card { border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; background: var(--surface); }
  .font-card.card-a { border-left: 4px solid var(--a); }
  .font-card.card-b { border-left: 4px solid var(--b); }
  .font-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em;
    padding: 2px 8px; border-radius: 10px; display: inline-block; margin-bottom: 6px; }
  .label-a { background: var(--a-bg); color: var(--a); }
  .label-b { background: var(--b-bg); color: var(--b); }
  .font-name { font-size: 17px; font-weight: 800; margin-bottom: 2px; }
  .font-file { font-size: 11px; color: var(--muted); font-family: monospace; margin-bottom: 12px; }
  .score-row { display: flex; align-items: center; gap: 14px; }
  .score-circle { width: 72px; height: 72px; border-radius: 50%; border: 4px solid;
    display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; }
  .score-num { font-size: 22px; font-weight: 800; line-height: 1; }
  .score-grade { font-size: 11px; font-weight: 700; }
  .score-bars { flex: 1; display: flex; flex-direction: column; gap: 5px; }
  .sbar { display: flex; align-items: center; gap: 8px; font-size: 11px; }
  .sbar-lbl { width: 100px; color: var(--muted); flex-shrink: 0; }
  .sbar-track { flex: 1; background: var(--border); border-radius: 3px; height: 5px; overflow: hidden; }
  .sbar-fill { height: 100%; border-radius: 3px; }
  .sbar-val { width: 32px; text-align: right; font-weight: 600; }

  /* Sections */
  .section { margin-bottom: 32px; }
  .section-title { font-size: 15px; font-weight: 700; padding-bottom: 8px;
    border-bottom: 2px solid var(--border); margin-bottom: 16px;
    display: flex; align-items: center; gap: 8px; }
  .section-title .tag { font-size: 11px; font-weight: 500; color: var(--muted);
    background: var(--border); padding: 2px 8px; border-radius: 10px; }

  /* Fix plan */
  .fix-item { display: flex; gap: 12px; padding: 12px 16px; border-radius: var(--radius);
    border: 1px solid; margin-bottom: 10px; }
  .fix-item.error  { background: var(--fail-bg); border-color: #fca5a5; }
  .fix-item.warning { background: var(--warn-bg); border-color: #fcd34d; }
  .fix-item.info   { background: var(--info-bg); border-color: #93c5fd; }
  .fix-icon { font-size: 18px; flex-shrink: 0; }
  .fix-body { flex: 1; min-width: 0; }
  .fix-cat { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
  .fix-action { font-size: 14px; font-weight: 600; margin: 3px 0; }
  .fix-details { font-size: 12px; color: var(--text); line-height: 1.7; }
  .fix-details li { margin-left: 18px; }

  /* Rules block */
  .rules-block { background: #1e293b; border-radius: 6px; padding: 10px 14px; margin-top: 8px;
    max-height: 200px; overflow-y: auto; }
  .rule-line { font-family: monospace; font-size: 11.5px; color: #e2e8f0; line-height: 1.8;
    border-bottom: 1px solid #334155; padding-bottom: 2px; }
  .rule-line:last-child { border-bottom: none; }
  .rule-preview { color: #a78bfa; font-size: 15px; }
  .rules-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
    color: var(--muted); margin-bottom: 4px; }

  /* Feature comparison table */
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: var(--surface); text-align: left; padding: 8px 12px; font-size: 11px;
    font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--muted);
    border-bottom: 2px solid var(--border); }
  td { padding: 8px 12px; border-bottom: 1px solid var(--border); vertical-align: middle; }
  tr:hover td { background: #f1f5f9; }
  .mono { font-family: monospace; font-weight: 700; font-size: 13px; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
  .pill-pass { background: var(--pass-bg); color: var(--pass); }
  .pill-fail { background: var(--fail-bg); color: var(--fail); }
  .pill-warn { background: var(--warn-bg); color: var(--warn); }
  .pill-a   { background: var(--a-bg); color: var(--a); }
  .pill-b   { background: var(--b-bg); color: var(--b); }
  .num-a { font-weight: 700; color: var(--a); }
  .num-b { font-weight: 700; color: var(--b); }
  .delta-pos { color: var(--pass); font-weight: 700; }
  .delta-neg { color: var(--fail); font-weight: 700; }
  .req-tag  { font-size: 9px; background: #fef9c3; color: #92400e; padding: 1px 5px; border-radius: 8px; font-weight: 700; vertical-align: middle; margin-left: 4px; }
  tr.missing-a { background: #fff7ed; }

  /* Coverage cells */
  .glyph-grid { display: flex; flex-wrap: wrap; gap: 4px; }
  .gc { width: 48px; height: 48px; border: 1px solid var(--border); border-radius: 6px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-size: 9px; color: var(--muted); cursor: default; position: relative; }
  .gc:hover { z-index: 5; transform: scale(1.5); }
  .gc.b-has { background: #f3e8ff; border-color: #c4b5fd; }
  .gc-char { font-size: 18px; line-height: 1.1; }
  .gc-cp   { font-size: 8px; }

  .stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; margin-bottom: 20px; }
  .stat-box { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 12px; text-align: center; }
  .stat-num { font-size: 24px; font-weight: 700; }
  .stat-lbl { font-size: 11px; color: var(--muted); margin-top: 2px; }

  footer { text-align: center; padding: 24px; color: var(--muted); font-size: 12px;
    border-top: 1px solid var(--border); margin-top: 40px; }
  code { font-family: monospace; background: var(--surface); border: 1px solid var(--border);
    padding: 1px 5px; border-radius: 4px; font-size: 12px; }
  .cat-label { font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase;
    letter-spacing: .06em; margin: 12px 0 6px; }
</style>
</head>
<body>

<header>
  <div class="title">ಕನ್ನಡ Font Quality Inspector — Cross-Font Comparison</div>
  <div class="sub">Sanchaya Font Tools · typetest.sanchaya.net · ${formatDate(meta.timestamp)}</div>
</header>

<div class="container">

  <!-- ── Hero ── -->
  <div class="hero">
    <div class="font-card card-a">
      <div class="font-label label-a">Font A — to fix</div>
      <div class="font-name">${esc(nameA)}</div>
      <div class="font-file">${esc(rA.meta.fontFile)}</div>
      <div class="score-row">
        <div class="score-circle" style="border-color:${gradeColorA};color:${gradeColorA}">
          <div class="score-num" style="color:${gradeColorA}">${rA.score.total}</div>
          <div class="score-grade" style="color:${gradeColorA}">Grade ${rA.score.grade}</div>
        </div>
        <div class="score-bars">
          ${compScoreBar('Coverage', rA.score.breakdown.coverage, 40, gradeColorA)}
          ${compScoreBar('OT Features', rA.score.breakdown.features, 30, gradeColorA)}
          ${compScoreBar('Script Tables', rA.score.breakdown.scripts, 10, gradeColorA)}
          ${compScoreBar('Metadata', rA.score.breakdown.metadata, 10, gradeColorA)}
          ${compScoreBar('Revival', rA.score.breakdown.revival, 10, gradeColorA)}
        </div>
      </div>
    </div>

    <div class="hero-vs">vs</div>

    <div class="font-card card-b">
      <div class="font-label label-b">Font B — reference</div>
      <div class="font-name">${esc(nameB)}</div>
      <div class="font-file">${esc(rB.meta.fontFile)}</div>
      <div class="score-row">
        <div class="score-circle" style="border-color:${gradeColorB};color:${gradeColorB}">
          <div class="score-num" style="color:${gradeColorB}">${rB.score.total}</div>
          <div class="score-grade" style="color:${gradeColorB}">Grade ${rB.score.grade}</div>
        </div>
        <div class="score-bars">
          ${compScoreBar('Coverage', rB.score.breakdown.coverage, 40, gradeColorB)}
          ${compScoreBar('OT Features', rB.score.breakdown.features, 30, gradeColorB)}
          ${compScoreBar('Script Tables', rB.score.breakdown.scripts, 10, gradeColorB)}
          ${compScoreBar('Metadata', rB.score.breakdown.metadata, 10, gradeColorB)}
          ${compScoreBar('Revival', rB.score.breakdown.revival, 10, gradeColorB)}
        </div>
      </div>
    </div>
  </div>

  <!-- ── Fix Plan ── -->
  <div class="section">
    <div class="section-title">
      🔧 Fix Plan for Font A
      <span class="tag">${diff.fixPlan.length} action(s)</span>
      <span class="tag" style="color:${diff.scoreDelta >= 0 ? 'var(--pass)' : 'var(--fail)'}">
        Score gap: ${diff.scoreDelta >= 0 ? '+' : ''}${diff.scoreDelta} pts
      </span>
    </div>
    ${diff.fixPlan.length === 0
      ? `<div class="pill pill-pass">✓ Font A is comparable to Font B — no major gaps found</div>`
      : diff.fixPlan.map(item => `
        <div class="fix-item ${sevClass(item.severity)}">
          <div class="fix-icon">${sevIcon(item.severity)}</div>
          <div class="fix-body">
            <div class="fix-cat">${esc(item.category)}</div>
            <div class="fix-action">${esc(item.action)}</div>
            ${item.details && item.details.length > 0 ? `<ul class="fix-details">${item.details.map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
            ${item.hasSampleRules && diff.sampleRules[item.tag] ? renderRulesBlock(diff.sampleRules[item.tag], nameB) : ''}
          </div>
        </div>`).join('')}
  </div>

  <!-- ── GSUB Feature Comparison ── -->
  <div class="section">
    <div class="section-title">GSUB Feature Comparison
      <span class="tag">${Object.keys(diff.gsub.shared || {}).length} shared · ${(diff.gsub.onlyInB || []).length} only in B · ${(diff.gsub.onlyInA || []).length} only in A</span>
    </div>
    <table>
      <thead><tr>
        <th>Feature</th><th>Description</th>
        <th>Rules (A)</th><th>Rules (B)</th><th>Δ</th><th>Status</th>
      </tr></thead>
      <tbody>
        ${allGsubTags.map(tag => {
          const inA = diff.gsub.onlyInA.includes(tag) || diff.gsub.shared[tag] != null;
          const inB = diff.gsub.onlyInB.includes(tag) || diff.gsub.shared[tag] != null;
          const shared = diff.gsub.shared[tag];
          const isReq = requiredTags.has(tag);
          const fdesc = featureDesc[tag];
          const rulesA = shared ? shared.rulesA : (inA ? '✓' : '—');
          const rulesB = shared ? shared.rulesB : (inB ? '✓' : '—');
          const delta  = shared ? shared.delta : null;
          const status = !inA && inB ? `<span class="pill pill-fail">Missing in A</span>`
            : inA && !inB ? `<span class="pill pill-a">Only in A</span>`
            : delta != null && Math.abs(delta) >= 3 ? (delta > 0
              ? `<span class="pill pill-warn">B richer +${delta}</span>`
              : `<span class="pill pill-a">A richer +${-delta}</span>`)
            : `<span class="pill pill-pass">Equal</span>`;
          const rowClass = !inA && inB ? 'missing-a' : '';
          return `<tr class="${rowClass}">
            <td><span class="mono">${esc(tag)}</span>${isReq ? '<span class="req-tag">required</span>' : ''}</td>
            <td style="font-size:12px;color:var(--muted)">${esc(fdesc?.name || '')}<br><span style="font-size:11px">${esc(fdesc?.desc || '')}</span></td>
            <td class="num-a">${typeof rulesA === 'number' ? rulesA : `<span style="color:var(--muted)">${rulesA}</span>`}</td>
            <td class="num-b">${typeof rulesB === 'number' ? rulesB : `<span style="color:var(--muted)">${rulesB}</span>`}</td>
            <td>${delta != null ? `<span class="${delta > 0 ? 'delta-pos' : delta < 0 ? 'delta-neg' : ''}">${delta > 0 ? '+' : ''}${delta}</span>` : '—'}</td>
            <td>${status}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>

    ${diff.sampleRules && Object.keys(diff.sampleRules).length > 0 ? `
    <div style="margin-top:24px">
      <div class="cat-label">Sample Rules from Font B (blueprints for adding to Font A)</div>
      ${Object.entries(diff.sampleRules).map(([tag, rules]) => {
        if (!rules || rules.length === 0) return '';
        const fdesc = featureDesc[tag];
        return `<div style="margin-bottom:16px">
          <div style="font-size:13px;font-weight:700;margin-bottom:4px">
            <span class="mono">${esc(tag)}</span>
            <span style="color:var(--muted);font-weight:400;font-size:12px"> — ${esc(fdesc?.name || '')}</span>
          </div>
          ${renderRulesBlock(rules, nameB)}
        </div>`;
      }).join('')}
    </div>` : ''}
  </div>

  <!-- ── GPOS Feature Comparison ── -->
  <div class="section">
    <div class="section-title">GPOS Feature Comparison</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      ${[...new Set([
          ...(diff.gpos.onlyInA||[]),
          ...(diff.gpos.onlyInB||[]),
          ...(rA.gpos.featureRecords||[]).map(f=>f.tag),
          ...(rB.gpos.featureRecords||[]).map(f=>f.tag),
        ])].sort().map(tag => {
          const inA = (rA.gpos.featureRecords||[]).some(f => f.tag === tag);
          const inB = (rB.gpos.featureRecords||[]).some(f => f.tag === tag);
          const cls = !inA && inB ? 'pill-fail' : inA && !inB ? 'pill-a' : 'pill-pass';
          const lbl = !inA && inB ? `✗ ${tag} (only in B)` : inA && !inB ? `${tag} (only in A)` : `✓ ${tag}`;
          return `<span class="pill ${cls}">${esc(lbl)}</span>`;
        }).join('')}
    </div>
  </div>

  <!-- ── Unicode Coverage diff ── -->
  <div class="section">
    <div class="section-title">Unicode Coverage Difference
      <span class="tag">${diff.coverage.inBoth} in both · ${(diff.coverage.onlyInB||[]).length} only in B · ${(diff.coverage.onlyInA||[]).length} only in A</span>
    </div>
    ${(diff.coverage.onlyInB||[]).length > 0 ? `
    <div class="cat-label" style="color:var(--b)">Glyphs in Font B but missing from Font A</div>
    <div class="glyph-grid" style="margin-bottom:16px">
      ${(diff.coverage.onlyInB||[]).map(r => `
        <div class="gc b-has" title="${esc(r.name)} ${r.cpHex}${r.required?' (required)':''}${r.revival?' (revival)':''}">
          <div class="gc-char">${r.char}</div>
          <div class="gc-cp">${r.cpHex}</div>
        </div>`).join('')}
    </div>` : ''}
    ${(diff.coverage.onlyInA||[]).length > 0 ? `
    <div class="cat-label" style="color:var(--a)">Glyphs in Font A but not in Font B</div>
    <div class="glyph-grid">
      ${(diff.coverage.onlyInA||[]).map(r => `
        <div class="gc" style="background:var(--a-bg);border-color:#bfdbfe" title="${esc(r.name)} ${r.cpHex}">
          <div class="gc-char">${r.char}</div>
          <div class="gc-cp">${r.cpHex}</div>
        </div>`).join('')}
    </div>` : ''}
  </div>

  <!-- ── Individual Font Summaries ── -->
  <div class="section">
    <div class="section-title">Individual Issue Summaries</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      ${renderIssueSummary(rA, nameA, 'A', 'var(--a)')}
      ${renderIssueSummary(rB, nameB, 'B', 'var(--b)')}
    </div>
  </div>

</div>

<footer>
  Cross-Font Comparison · Kannada Font Quality Inspector v${esc(meta.version)} ·
  <a href="https://typetest.sanchaya.net" style="color:var(--muted)">typetest.sanchaya.net</a>
</footer>
</body>
</html>`;
}

// ─── Reporter helpers ─────────────────────────────────────────────────────────

function gradeColor(grade) {
  return { A: '#16a34a', B: '#2563eb', C: '#d97706', D: '#ea580c', F: '#dc2626' }[grade] || '#64748b';
}

function compScoreBar(label, val, max, color) {
  const pct = Math.round((val / max) * 100);
  return `<div class="sbar">
    <span class="sbar-lbl">${label}</span>
    <div class="sbar-track"><div class="sbar-fill" style="width:${pct}%;background:${color}"></div></div>
    <span class="sbar-val">${val}/${max}</span>
  </div>`;
}

function renderRulesBlock(rules, sourceName) {
  if (!rules || rules.length === 0) return '';
  return `<div style="margin-top:6px">
    <div class="rules-label">Sample rules from ${esc(sourceName || 'Font B')}</div>
    <div class="rules-block">
      ${rules.map(r => `<div class="rule-line">
        ${r.preview ? `<span class="rule-preview">${esc(r.preview)}</span> &nbsp; ` : ''}
        <span style="color:#94a3b8;font-size:10px">${esc(r.display)}</span>
      </div>`).join('')}
    </div>
  </div>`;
}

function renderIssueSummary(report, name, label, color) {
  const errors  = report.issues.filter(i => i.severity === 'error');
  const warns   = report.issues.filter(i => i.severity === 'warning');
  return `<div style="border:1px solid var(--border);border-left:4px solid ${color};border-radius:var(--radius);padding:14px">
    <div style="font-weight:700;margin-bottom:8px">Font ${label}: ${esc(name)}</div>
    ${errors.length === 0 && warns.length === 0
      ? `<div class="pill pill-pass">✓ No critical issues</div>`
      : [...errors.slice(0,5), ...warns.slice(0,3)].map(i => `
          <div style="font-size:12px;padding:3px 0;border-bottom:1px solid var(--border)">
            <span>${i.severity === 'error' ? '⛔' : '⚠️'}</span>
            ${esc(i.message)}
          </div>`).join('')}
    ${errors.length > 5 ? `<div style="font-size:11px;color:var(--muted);margin-top:4px">…and ${errors.length - 5} more errors</div>` : ''}
  </div>`;
}

module.exports = { renderHtmlReport, renderComparisonReport };
