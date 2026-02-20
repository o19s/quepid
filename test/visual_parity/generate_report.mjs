/**
 * Generate HTML Comparison Report
 *
 * Reads screenshots from two branch directories and produces
 * a side-by-side HTML report for visual comparison.
 *
 * Usage:
 *   node test/visual_parity/generate_report.mjs
 *   node test/visual_parity/generate_report.mjs --branch-a deangularjs --branch-b deangularjs-experimental
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const API_DIR = path.join(__dirname, 'api_structures');

// Auto-detect branches or use CLI args
function detectBranches() {
  const dirs = fs.readdirSync(SCREENSHOTS_DIR).filter(d =>
    fs.statSync(path.join(SCREENSHOTS_DIR, d)).isDirectory()
  ).sort();

  if (dirs.length < 2) {
    console.error('Need screenshots from at least 2 branches. Run capture first.');
    process.exit(1);
  }
  return dirs;
}

const branches = detectBranches();
const BRANCH_A = getArg('branch-a', branches[0]);
const BRANCH_B = getArg('branch-b', branches[1]);

console.log(`\n📊 Generating comparison report: ${BRANCH_A} vs ${BRANCH_B}\n`);

// ---------------------------------------------------------------------------
// Gather screenshot pairs
// ---------------------------------------------------------------------------
const dirA = path.join(SCREENSHOTS_DIR, BRANCH_A);
const dirB = path.join(SCREENSHOTS_DIR, BRANCH_B);

const filesA = new Set(fs.readdirSync(dirA).filter(f => f.endsWith('.png')));
const filesB = new Set(fs.readdirSync(dirB).filter(f => f.endsWith('.png')));

const allFiles = [...new Set([...filesA, ...filesB])].sort();

const pairs = allFiles.map(file => {
  const name = file.replace('.png', '').replace(/^\d+-/, '');
  return {
    name,
    file,
    hasA: filesA.has(file),
    hasB: filesB.has(file),
    pathA: filesA.has(file) ? path.relative(__dirname, path.join(dirA, file)).replace(/\\/g, '/') : null,
    pathB: filesB.has(file) ? path.relative(__dirname, path.join(dirB, file)).replace(/\\/g, '/') : null,
  };
});

// ---------------------------------------------------------------------------
// Load API diff report if available
// ---------------------------------------------------------------------------
let apiReport = null;
const apiDiffPath = path.join(API_DIR, 'api_diff_report.json');
if (fs.existsSync(apiDiffPath)) {
  apiReport = JSON.parse(fs.readFileSync(apiDiffPath, 'utf-8'));
}

// ---------------------------------------------------------------------------
// Generate HTML
// ---------------------------------------------------------------------------
const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

function generateScreenshotRow(pair) {
  const statusBadge = pair.hasA && pair.hasB
    ? ''
    : pair.hasA
      ? '<span class="badge missing">Missing in B</span>'
      : '<span class="badge missing">Missing in A</span>';

  const imgA = pair.hasA
    ? `<img src="${pair.pathA}" alt="${pair.name} (${BRANCH_A})" loading="lazy" />`
    : '<div class="placeholder">No screenshot</div>';
  const imgB = pair.hasB
    ? `<img src="${pair.pathB}" alt="${pair.name} (${BRANCH_B})" loading="lazy" />`
    : '<div class="placeholder">No screenshot</div>';

  return `
    <div class="comparison-pair" id="${pair.name}">
      <h3>${pair.name} ${statusBadge}</h3>
      <div class="side-by-side">
        <div class="branch">
          <h4>${BRANCH_A}</h4>
          ${imgA}
        </div>
        <div class="branch">
          <h4>${BRANCH_B}</h4>
          ${imgB}
        </div>
      </div>
    </div>`;
}

function generateApiSection() {
  if (!apiReport) return '';

  const rows = apiReport.report.map(entry => {
    const statusClass = entry.status === 'identical' ? 'pass' : 'fail';
    const statusIcon = entry.status === 'identical' ? '✅' : '❌';
    const diffDetails = entry.diffs.length > 0
      ? `<ul>${entry.diffs.map(d => `<li><code>${d.path}</code>: ${d.left} → ${d.right}</li>`).join('')}</ul>`
      : '';
    return `
      <tr class="${statusClass}">
        <td>${entry.endpoint}</td>
        <td>${statusIcon} ${entry.status}</td>
        <td>${diffDetails}</td>
      </tr>`;
  }).join('');

  return `
    <section id="api-comparison">
      <h2>API Structure Comparison</h2>
      <p>Comparing response key structures between <strong>${apiReport.branchA}</strong> and <strong>${apiReport.branchB}</strong>.</p>
      <table>
        <thead>
          <tr>
            <th>Endpoint</th>
            <th>Status</th>
            <th>Differences</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </section>`;
}

const tocLinks = pairs.map(p =>
  `<li><a href="#${p.name}">${p.name}</a>${!p.hasA || !p.hasB ? ' ⚠️' : ''}</li>`
).join('\n        ');

const screenshotSections = pairs.map(generateScreenshotRow).join('\n');
const apiSection = generateApiSection();

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visual Parity: ${BRANCH_A} vs ${BRANCH_B}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      color: #333;
      padding: 2rem;
    }
    h1 { margin-bottom: 0.5rem; }
    .meta { color: #666; margin-bottom: 2rem; }
    .toc {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .toc h2 { margin-bottom: 0.5rem; }
    .toc ul { columns: 3; list-style: none; padding: 0; }
    .toc li { padding: 0.2rem 0; }
    .toc a { color: #0066cc; text-decoration: none; }
    .toc a:hover { text-decoration: underline; }
    .comparison-pair {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .comparison-pair h3 { margin-bottom: 1rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; }
    .side-by-side { display: flex; gap: 1rem; }
    .branch { flex: 1; min-width: 0; }
    .branch h4 {
      text-align: center;
      background: #e8e8e8;
      padding: 0.3rem;
      border-radius: 4px;
      margin-bottom: 0.5rem;
      font-size: 0.85rem;
    }
    .branch img {
      width: 100%;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .placeholder {
      background: #f0f0f0;
      border: 2px dashed #ccc;
      padding: 3rem;
      text-align: center;
      color: #999;
      border-radius: 4px;
    }
    .badge {
      font-size: 0.75rem;
      padding: 0.15rem 0.5rem;
      border-radius: 3px;
      font-weight: normal;
    }
    .badge.missing { background: #fff3cd; color: #856404; }
    #api-comparison { background: white; border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    #api-comparison h2 { margin-bottom: 1rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f8f8; }
    tr.fail { background: #fff5f5; }
    tr.pass { }
    code { background: #f0f0f0; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.85rem; }
    @media (max-width: 900px) {
      .side-by-side { flex-direction: column; }
      .toc ul { columns: 1; }
    }
  </style>
</head>
<body>
  <h1>Visual Parity Report</h1>
  <p class="meta">${BRANCH_A} vs ${BRANCH_B} &mdash; Generated ${timestamp}</p>

  <nav class="toc">
    <h2>Table of Contents</h2>
    <ul>
      ${tocLinks}
      ${apiReport ? '<li><a href="#api-comparison">API Structure Comparison</a></li>' : ''}
    </ul>
  </nav>

  ${screenshotSections}

  ${apiSection}

</body>
</html>`;

const outPath = path.join(__dirname, 'report.html');
fs.writeFileSync(outPath, html);
console.log(`✅ Report generated: ${outPath}`);
console.log(`   ${pairs.length} screenshot pairs, ${apiReport ? apiReport.report.length : 0} API endpoints\n`);
