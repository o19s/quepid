#!/usr/bin/env node

// Dead-rule audit for the Angular `core.css` stylesheet bundle.
//
// Scans every source file that `buildCoreCSS()` in build_css.js
// concatenates into core.css, and asks PurgeCSS which selectors are
// never referenced by any template, helper, or script. Writes a
// per-source-file report (default tmp/css-audit/, override with CSS_AUDIT_DIR).
//
// Run inside the project's Docker container:
//   bin/docker r yarn audit:css
// Host-only when tmp/css-audit is root-owned from Docker — see yarn audit:css:host.
// Exits before PurgeCSS if the output directory is not writable.
//
// Why per-file rather than per-bundle: the core CSS bundle is built by
// concatenation, so an unused selector in core-bootstrap.css is attributable
// to that file versus npm Bootstrap noise in node_modules/bootstrap. Attribution matters.

const fs = require('fs');
const path = require('path');
const { PurgeCSS } = require('purgecss');

/** Resolved output root for reports (absolute path). Override with CSS_AUDIT_DIR. */
const AUDIT_OUTPUT_DIR = path.resolve(
  process.env.CSS_AUDIT_DIR || path.join('tmp', 'css-audit')
);

/** Ensure the audit output directory exists and is writable (Docker-as-root reruns often break writes). */
function ensureWritableOutDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const probe = path.join(dir, `.write-probe-${process.pid}-${Date.now()}`);
  try {
    fs.writeFileSync(probe, '');
    fs.unlinkSync(probe);
  } catch (err) {
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      console.error(
        `Cannot write to ${dir} (${err.code}). If Docker created these files as root, fix ownership:\n` +
        `  sudo chown -R "$(id -u):$(id -g)" ${dir}\n` +
        `Or remove the directory and rerun. See docs/css_audit_core_triage.md.\n`
      );
      process.exit(1);
    }
    throw err;
  }
}

// Sources that compose core.css (mirrors buildCoreCSS in build_css.js).
// fonts.css is excluded — it's just @font-face declarations.
// Vendored bootstrap-icons and shepherd-theme are excluded — those
// belong to upstream packages.
const SOURCES = [
  'node_modules/bootstrap/dist/css/bootstrap.css',
  'app/assets/stylesheets/core-additions.css',
  'app/assets/stylesheets/core-bootstrap.css',
  'app/assets/stylesheets/style.css',
  'app/assets/stylesheets/panes.css',
  'app/assets/stylesheets/stackedChart.css',
  'app/assets/stylesheets/tour.css',
  'app/assets/stylesheets/cases.css',
  'app/assets/stylesheets/docs.css',
  'app/assets/stylesheets/settings.css',
  'app/assets/stylesheets/qscore.css',
  'app/assets/stylesheets/qgraph.css',
  'app/assets/stylesheets/misc.css',
  'app/assets/stylesheets/animation.css',
  'app/assets/stylesheets/froggy.css',
];

// Vendored upstream files we report on but expect high false-positive
// noise from (selectors used only when runtime code adds them).
const NOISY_SOURCES = new Set(['node_modules/bootstrap/dist/css/bootstrap.css']);

// Where templates, scripts, and helpers live. PurgeCSS extracts any
// token that *could* be a class name from these, so anything appearing
// as a string literal (in ERB, Angular HTML, JS, or Ruby) is detected.
const CONTENT = [
  'app/views/**/*.erb',
  'app/views/**/*.html',
  'app/helpers/**/*.rb',
  'app/assets/javascripts/**/*.js',
  'app/assets/javascripts/**/*.html',
  'app/assets/templates/**/*.html',
  'app/javascript/**/*.js',
  'app/javascript/**/*.html',
  'config/locales/**/*.yml',
];

// Safelist: classes that are real but never appear as literals in the
// content globs (runtime-added by Angular, Bootstrap JS, jQuery UI,
// Tether-Shepherd, etc.).
const SAFELIST = {
  standard: [
    // Bootstrap 3 JS-added state classes
    'in', 'fade', 'show', 'open', 'active', 'disabled', 'loading',
    'collapse', 'collapsing', 'collapsed',
    // Modal sizes from `'modal-' + opts.size` in JS
    'modal-sm', 'modal-lg', 'modal-xl', 'modal-fullscreen',
    // Alert variants emitted by app/helpers (bootstrap_class_for)
    'alert-success', 'alert-info', 'alert-warning', 'alert-danger',
    'alert-primary', 'alert-secondary',
    // Common runtime-toggled utility
    'hidden',
  ],
  // Whole namespaces added at runtime by libraries — never appear as
  // literals in templates but the CSS rules supporting them are live.
  greedy: [
    /^ng-/,             // Angular directive states
    /^ui-/,             // jQuery UI
    /^shepherd-/,       // tether-shepherd tour
    /^tooltip/,         // BS5 tooltip variants
    /^popover/,         // BS5 popover variants
    /^bs-tooltip-/,
    /^bs-popover-/,
    /^tour-/,
    /^wizard/,          // angular-wizard
    /^tags-/, /^ti-/,   // ng-tags-input
    /^autocomplete/,    // autocompleter library
    /^ace_/,            // Ace editor
    /^d3-tip/,          // d3-tip
    /^vega-/,           // Vega embed
    /^json-/,           // ng-json-explorer
  ],
};

async function auditFile(cssFile) {
  if (!fs.existsSync(cssFile)) {
    return { file: cssFile, missing: true };
  }

  const results = await new PurgeCSS().purge({
    content: CONTENT,
    css: [cssFile],
    safelist: SAFELIST,
    rejected: true,
    rejectedCss: true,
    // Keep keyframes/font-faces conservative: we're hunting unused
    // selectors, not unused @keyframes (false-positive risk is high
    // when animation names are concatenated in JS).
    keyframes: false,
    fontFace: false,
    variables: false,
  });

  const result = results[0];
  const rejected = result.rejected || [];
  const rejectedCss = result.rejectedCss || '';
  const totalSize = fs.statSync(cssFile).size;
  // Approximate kept-size by subtracting rejectedCss length from total.
  // Not exact (whitespace/comments differ) but good enough for a report.
  const deadBytes = Buffer.byteLength(rejectedCss, 'utf8');
  const pct = totalSize > 0 ? ((deadBytes / totalSize) * 100).toFixed(1) : '0.0';

  return {
    file: cssFile,
    rejected,
    rejectedCss,
    totalSize,
    deadBytes,
    pct,
  };
}

function writeReports(report) {
  const basename = path.basename(report.file, '.css');
  fs.writeFileSync(
    path.join(AUDIT_OUTPUT_DIR, `${basename}.dead.txt`),
    report.rejected.join('\n') + '\n'
  );
  fs.writeFileSync(
    path.join(AUDIT_OUTPUT_DIR, `${basename}.dead.css`),
    `/* Rejected selectors from ${report.file} */\n` +
    `/* ${report.rejected.length} selectors, ~${report.deadBytes} bytes (${report.pct}% of source) */\n\n` +
    report.rejectedCss
  );
}

function writeSummary(reports) {
  const lines = [];
  lines.push('# core.css dead-rule audit');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  const relOutDir = path.relative(process.cwd(), AUDIT_OUTPUT_DIR) || '.';
  lines.push(`Reports directory: ${relOutDir}`);
  lines.push('');
  lines.push('Per-file breakdown of selectors that PurgeCSS could not find a reference for.');
  lines.push('Noisy sources are vendored upstream files where runtime-added classes inflate the count;');
  lines.push('treat their numbers as upper bounds, not delete-lists.');
  lines.push('');
  lines.push('| Source | Total (KB) | Dead selectors | Dead (KB) | Dead % | Notes |');
  lines.push('| --- | ---: | ---: | ---: | ---: | --- |');
  for (const r of reports) {
    if (r.missing) {
      lines.push(`| ${r.file} | — | — | — | — | missing |`);
      continue;
    }
    const noisy = NOISY_SOURCES.has(r.file) ? 'vendored (noisy)' : '';
    const totalKB = (r.totalSize / 1024).toFixed(1);
    const deadKB = (r.deadBytes / 1024).toFixed(1);
    lines.push(`| ${r.file} | ${totalKB} | ${r.rejected.length} | ${deadKB} | ${r.pct}% | ${noisy} |`);
  }
  lines.push('');
  lines.push('## How to use this report');
  lines.push('');
  lines.push('1. Start with non-vendored files (highest signal).');
  lines.push('2. For each candidate selector, grep the codebase one more time before deleting —');
  lines.push('   PurgeCSS can miss class names built from computed strings or stored in YAML/JSON.');
  lines.push('3. Delete in small batches and verify visually per the CLAUDE.md screenshot policy.');
  lines.push('');
  lines.push('See `<source>.dead.css` for the full rule bodies (suitable for review/diff).');
  lines.push('See `<source>.dead.txt` for a plain selector list.');

  fs.writeFileSync(path.join(AUDIT_OUTPUT_DIR, 'SUMMARY.md'), lines.join('\n') + '\n');
}

async function main() {
  console.log('Auditing core.css sources for unreferenced selectors...');
  console.log(`Content globs: ${CONTENT.length} patterns`);
  console.log(`CSS sources: ${SOURCES.length} files`);
  console.log(`Output directory: ${AUDIT_OUTPUT_DIR}`);
  console.log('');

  ensureWritableOutDir(AUDIT_OUTPUT_DIR);

  const reports = [];
  for (const src of SOURCES) {
    process.stdout.write(`  ${src} ... `);
    try {
      const report = await auditFile(src);
      if (report.missing) {
        console.log('(missing, skipped)');
      } else {
        console.log(`${report.rejected.length} dead selectors (${report.pct}%)`);
        writeReports(report);
      }
      reports.push(report);
    } catch (err) {
      console.log(`error: ${err.message}`);
      reports.push({ file: src, missing: true });
    }
  }

  writeSummary(reports);
  console.log('');
  console.log(`Reports written to ${AUDIT_OUTPUT_DIR}/`);
  console.log(`Start with ${path.join(AUDIT_OUTPUT_DIR, 'SUMMARY.md')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
