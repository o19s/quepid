/**
 * Generate HTML Comparison Report
 *
 * Reads screenshots from two branch directories and produces
 * a side-by-side HTML report for visual comparison.
 *
 * Usage:
 *   node test/visual_parity/generate_report.mjs
 *   node test/visual_parity/generate_report.mjs --branch-a main --branch-b deangularjs-incremental
 * Env: VISUAL_PARITY_BRANCH_A / VISUAL_PARITY_BRANCH_B (same as compare_apis --diff)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const API_DIR = path.join(__dirname, 'api_structures');

const shotDirs = fs.existsSync(SCREENSHOTS_DIR)
  ? fs.readdirSync(SCREENSHOTS_DIR).filter(d =>
      fs.statSync(path.join(SCREENSHOTS_DIR, d)).isDirectory()
    )
  : [];

if (shotDirs.length < 2) {
  console.error('Need screenshots from at least 2 branches. Run capture first.');
  process.exit(1);
}

const cliA = getArg('branch-a', null);
const cliB = getArg('branch-b', null);
const envA = process.env.VISUAL_PARITY_BRANCH_A || null;
const envB = process.env.VISUAL_PARITY_BRANCH_B || null;

const sortedShots = [...shotDirs].sort();
let BRANCH_A;
let BRANCH_B;
if (cliA && cliB) {
  BRANCH_A = cliA;
  BRANCH_B = cliB;
} else if (envA && envB) {
  BRANCH_A = envA;
  BRANCH_B = envB;
} else {
  if (sortedShots.length > 2) {
    console.warn(`⚠️  ${sortedShots.length} dirs in screenshots/: ${sortedShots.join(', ')}`);
    console.warn('    Using first two (lexicographic). Remove extras or set VISUAL_PARITY_BRANCH_A/B or --branch-a/--branch-b.\n');
  }
  BRANCH_A = sortedShots[0];
  BRANCH_B = sortedShots[1];
}

const dirA = path.join(SCREENSHOTS_DIR, BRANCH_A);
const dirB = path.join(SCREENSHOTS_DIR, BRANCH_B);

if (!shotDirs.includes(BRANCH_A) || !shotDirs.includes(BRANCH_B)) {
  console.error(`Missing screenshot dir(s). Available: ${shotDirs.join(', ')}`);
  process.exit(1);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

console.log(`\n📊 Generating comparison report: ${BRANCH_A} vs ${BRANCH_B}\n`);

// ---------------------------------------------------------------------------
// Route groups for ToC organization
// ---------------------------------------------------------------------------
const ROUTE_GROUPS = [
  { label: 'Authentication', prefix: '00-' },
  { label: 'Home', prefix: '01-' },
  { label: 'Cases', prefix: ['02-', '03-'] },
  { label: 'Case Workspace', prefix: ['04-case-workspace', '04-case-workspace-expanded'], exact: true },
  { label: 'Case Workspace — New UI', prefix: '04-case-workspace-new-ui', exact: true },
  { label: 'Case Workspace — Tune Relevance', prefix: '04a' },
  { label: 'Case Workspace — Header Dropdowns', prefix: ['04b', '04c', '04d'] },
  { label: 'Case Workspace — Action Bar Modals', prefix: '04e' },
  { label: 'Case Workspace — Archived State', prefix: '04f' },
  { label: 'Books', prefix: ['05-', '06-', '07-', '08-', '21-', '22-', '23-', '24-', '25-'] },
  { label: 'Scorers', prefix: ['09-', '10-'] },
  { label: 'Search Endpoints', prefix: ['11-', '12-', '13-'] },
  { label: 'Teams', prefix: ['14-', '15-'] },
  { label: 'Profile', prefix: '16-' },
  { label: 'Analytics', prefix: '17-' },
  { label: 'Admin', prefix: ['18-', '19-', '20-'] },
];

function getGroup(filename) {
  for (const group of ROUTE_GROUPS) {
    const prefixes = Array.isArray(group.prefix) ? group.prefix : [group.prefix];
    for (const p of prefixes) {
      if (group.exact) {
        if (filename === p + '.png') return group.label;
      } else {
        if (filename.startsWith(p)) return group.label;
      }
    }
  }
  return 'Other';
}

// ---------------------------------------------------------------------------
// Detect changed files to flag potentially affected screenshots
// ---------------------------------------------------------------------------
// Map changed source files to screenshot tags/groups that might be affected
const FILE_TO_GROUPS = [
  { pattern: /views\/layouts\/_header\.html|controllers\/dropdown_controller|views\/dropdown\/cases/, groups: ['Case Workspace — Header Dropdowns'] },
  { pattern: /views\/core\/_case_header|controllers\/case_score_controller|controllers\/sparkline_controller/, groups: ['Case Workspace'] },
  { pattern: /resizable_pane_controller\.js|panes\.css/, groups: ['Case Workspace — Tune Relevance'] },
  { pattern: /controllers\/clone_case_controller|controllers\/delete_case_options_controller|controllers\/export_case_controller|controllers\/import_ratings_controller|controllers\/judgements_controller|controllers\/snapshot_controller|controllers\/snapshot_comparison_controller/, groups: ['Case Workspace — Action Bar Modals'] },
  { pattern: /views\/core\/_action_bar|views\/core\/_action_bar_modals/, groups: ['Case Workspace', 'Case Workspace — Action Bar Modals'] },
  { pattern: /views\/books\/|controllers\/books_controller/, groups: ['Books'] },
  { pattern: /views\/scorers\/|controllers\/scorers_controller/, groups: ['Scorers'] },
  { pattern: /views\/teams\/|controllers\/teams_controller/, groups: ['Teams'] },
  { pattern: /views\/search_endpoints\//, groups: ['Search Endpoints'] },
  { pattern: /views\/admin\/|controllers\/admin\//, groups: ['Admin'] },
  { pattern: /views\/profiles\//, groups: ['Profile'] },
  { pattern: /views\/sessions\/|controllers\/sessions_controller/, groups: ['Authentication'] },
  { pattern: /views\/layouts\/core\.html\.erb/, groups: ['Case Workspace'] },
  { pattern: /views\/home\/|views\/layouts\/application\.html/, groups: ['Home'] },
];

let changedGroups = new Set();
try {
  // 1. Check committed changes since last capture
  const lastCaptureFile = path.join(SCREENSHOTS_DIR, BRANCH_B, '.last_capture');
  if (fs.existsSync(lastCaptureFile)) {
    const lastCapture = fs.readFileSync(lastCaptureFile, 'utf-8').trim();
    const sinceFlag = `--since="${lastCapture}"`;
    const diffOutput = execSync(`git log ${sinceFlag} --name-only --pretty=format: HEAD 2>/dev/null || echo ""`, { encoding: 'utf-8' });
    const changedFiles = [...new Set(diffOutput.trim().split('\n').filter(Boolean))];
    for (const file of changedFiles) {
      for (const mapping of FILE_TO_GROUPS) {
        if (mapping.pattern.test(file)) {
          mapping.groups.forEach(g => changedGroups.add(g));
        }
      }
    }
  }

  // 2. Also check uncommitted changes (staged, modified, and untracked files)
  //    These won't appear in git log but may affect screenshots
  const statusOutput = execSync('git status --porcelain 2>/dev/null || echo ""', { encoding: 'utf-8' });
  const uncommittedFiles = statusOutput.trim().split('\n')
    .filter(Boolean)
    .map(line => line.slice(3)); // strip status prefix (e.g. "?? ", " M ", "A  ")
  for (const file of uncommittedFiles) {
    for (const mapping of FILE_TO_GROUPS) {
      if (mapping.pattern.test(file)) {
        mapping.groups.forEach(g => changedGroups.add(g));
      }
    }
  }
  // If no timestamp file AND no uncommitted changes match, don't flag anything
} catch {
  // git log/status failed, skip change detection
}

// ---------------------------------------------------------------------------
// Gather screenshot pairs (with fallback to other directories)
// ---------------------------------------------------------------------------
// When a partial recapture is run (e.g. --only workspace), only some pages
// are re-screenshotted.  The rest still exist in prior full-run directories
// (e.g. "main", "deangularjs-incremental").  Rather than silently dropping
// them from the report, we fall back: for every .png found in *any* screenshot
// directory, include it — preferring the primary dir, then the fallback.
//
// Fallback order: explicit --fallback-a / --fallback-b, then any other dirs.
const fallbackA = getArg('fallback-a', null);
const fallbackB = getArg('fallback-b', null);

function buildFallbackChain(primary, explicitFallback, excludeDir) {
  const chain = [primary];
  if (explicitFallback && explicitFallback !== primary) {
    const fbDir = path.join(SCREENSHOTS_DIR, explicitFallback);
    if (fs.existsSync(fbDir)) chain.push(fbDir);
  }
  // Add all other directories as lower-priority fallbacks,
  // but never fall back to the *other side's* primary directory —
  // that would show the same screenshot on both sides.
  for (const d of shotDirs) {
    const full = path.join(SCREENSHOTS_DIR, d);
    if (!chain.includes(full) && full !== excludeDir) chain.push(full);
  }
  return chain;
}

const chainA = buildFallbackChain(dirA, fallbackA, dirB);
const chainB = buildFallbackChain(dirB, fallbackB, dirA);

function findScreenshot(file, chain) {
  for (const dir of chain) {
    const full = path.join(dir, file);
    if (fs.existsSync(full)) {
      return { found: true, path: path.relative(__dirname, full).replace(/\\/g, '/'), fromPrimary: dir === chain[0] };
    }
  }
  return { found: false, path: null, fromPrimary: false };
}

// Collect the union of all .png filenames across every screenshot directory
const allPngFiles = new Set();
for (const d of shotDirs) {
  const dir = path.join(SCREENSHOTS_DIR, d);
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.png')) allPngFiles.add(f);
  }
}

const allFiles = [...allPngFiles].sort();

const pairs = allFiles.map(file => {
  const name = file.replace('.png', '').replace(/^\d+-/, '');
  const a = findScreenshot(file, chainA);
  const b = findScreenshot(file, chainB);
  return {
    name,
    file,
    hasA: a.found,
    hasB: b.found,
    pathA: a.path,
    pathB: b.path,
    fallbackA: a.found && !a.fromPrimary,
    fallbackB: b.found && !b.fromPrimary,
  };
});

// ---------------------------------------------------------------------------
// Load API diff report if available
// ---------------------------------------------------------------------------
let apiReport = null;
const apiDiffPath = path.join(API_DIR, 'api_diff_report.json');
if (fs.existsSync(apiDiffPath)) {
  apiReport = JSON.parse(fs.readFileSync(apiDiffPath, 'utf-8'));
  const samePair =
    (apiReport.branchA === BRANCH_A && apiReport.branchB === BRANCH_B) ||
    (apiReport.branchA === BRANCH_B && apiReport.branchB === BRANCH_A);
  if (!samePair) {
    console.warn(
      `⚠️  api_diff_report.json is for ${apiReport.branchA} vs ${apiReport.branchB}; report screenshots are ${BRANCH_A} vs ${BRANCH_B}. Re-run compare_apis --diff with matching branches.`
    );
  }
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

  const fallbackBadgeA = pair.fallbackA ? ' <span class="badge fallback">prior run</span>' : '';
  const fallbackBadgeB = pair.fallbackB ? ' <span class="badge fallback">prior run</span>' : '';

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
          <h4>${BRANCH_A}${fallbackBadgeA}</h4>
          ${imgA}
        </div>
        <div class="branch">
          <h4>${BRANCH_B}${fallbackBadgeB}</h4>
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
      ? `<ul>${entry.diffs.map(d => `<li><code>${escapeHtml(d.path)}</code>: ${escapeHtml(d.left)} → ${escapeHtml(d.right)}</li>`).join('')}</ul>`
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

// Group pairs for ToC and sections
const groupedPairs = new Map();
for (const pair of pairs) {
  const group = getGroup(pair.file);
  if (!groupedPairs.has(group)) groupedPairs.set(group, []);
  groupedPairs.get(group).push(pair);
}

const tocLinks = [...groupedPairs.entries()].map(([group, groupPairs]) => {
  const isChanged = changedGroups.has(group);
  const groupId = group.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const changeIndicator = isChanged ? ' 🔄' : '';
  const items = groupPairs.map(p =>
    `<li><a href="#${p.name}">${p.name}</a>${!p.hasA || !p.hasB ? ' ⚠️' : ''}</li>`
  ).join('\n          ');
  return `<li class="toc-group"><strong><a href="#group-${groupId}">${group}${changeIndicator}</a></strong>
          <ul>${items}</ul></li>`;
}).join('\n        ');

const screenshotSections = [...groupedPairs.entries()].map(([group, groupPairs]) => {
  const isChanged = changedGroups.has(group);
  const groupId = group.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const changeIndicator = isChanged ? ' <span class="badge changed">changed</span>' : '';
  const header = `<h2 id="group-${groupId}" class="group-header">${group}${changeIndicator}</h2>`;
  return header + groupPairs.map(generateScreenshotRow).join('\n');
}).join('\n');
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
    .toc > ul { list-style: none; padding: 0; columns: 2; }
    .toc li { padding: 0.2rem 0; }
    .toc .toc-group { break-inside: avoid; margin-bottom: 0.8rem; }
    .toc .toc-group > ul { list-style: none; padding-left: 1rem; }
    .toc a { color: #0066cc; text-decoration: none; }
    .toc a:hover { text-decoration: underline; }
    .group-header { margin: 2rem 0 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #0066cc; }
    .badge.changed { background: #d4edda; color: #155724; font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 3px; font-weight: normal; }
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
    .badge.fallback { background: #e2e3e5; color: #383d41; }
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
