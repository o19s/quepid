/**
 * Visual Parity Screenshot Capture
 *
 * Logs into Quepid and captures full-page screenshots of every significant view.
 *
 * Usage:
 *   node test/visual_parity/capture_screenshots.mjs --branch <branch_name>
 *   node test/visual_parity/capture_screenshots.mjs --branch deangularjs --base-url http://localhost:3000
 *   node test/visual_parity/capture_screenshots.mjs --branch deangularjs --email admin@example.com
 *
 * Route variant comparison (same branch, different URLs):
 *   --label <name>        Output directory name (defaults to --branch value)
 *   --variant <name>      Use named variant path/setup for pages that define it;
 *                          pages without the variant are skipped entirely.
 *
 * Filtering:
 *   --only <pattern>      Only capture pages whose name or tags match (comma-separated)
 *   --exclude <pattern>   Skip pages whose name or tags match (comma-separated)
 *   --list                List all available page names and tags, then exit
 *   --all                 Capture all pages (skip change detection)
 *
 * By default, only pages affected by code changes since the last capture are
 * recaptured (based on .last_capture timestamp and git log). Use --all to
 * force a full recapture.
 *
 * Examples:
 *   --only header                     Capture only pages tagged "header"
 *   --only 04-case-workspace          Capture just that one screenshot
 *   --only header,workspace           Capture pages matching either tag
 *   --exclude admin,books             Skip admin and books pages
 *   --label new-ui --variant new-ui   Capture new-ui variant pages into screenshots/new-ui/
 *   --all                             Force recapture of all pages
 */

import { chromium } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const BRANCH   = getArg('branch', 'unknown');
const BASE_URL = getArg('base-url', 'http://localhost:3000');
const LABEL    = getArg('label', BRANCH);
const VARIANT  = getArg('variant', '');
const OUT_DIR  = path.join(__dirname, 'screenshots', LABEL);

const LOGIN_EMAIL    = getArg('email', 'quepid+realisticactivity@o19s.com');
const LOGIN_PASSWORD = getArg('password', 'password');

const ONLY_FILTER    = getArg('only', '');
const EXCLUDE_FILTER = getArg('exclude', '');
const LIST_MODE      = args.includes('--list');
const ALL_MODE       = args.includes('--all');

// ---------------------------------------------------------------------------
// File-to-page mapping for change detection
// ---------------------------------------------------------------------------
// Maps source file patterns to page name prefixes that should be recaptured.
// When a file matching a pattern has changed since the last capture, only
// pages whose name starts with one of the listed prefixes are recaptured.
const FILE_TO_PAGES = [
  { pattern: /views\/sessions\/|controllers\/sessions_controller/, prefixes: ['00-'] },
  { pattern: /views\/home\/|views\/layouts\/application\.html/, prefixes: ['01-'] },
  { pattern: /views\/cases\/|controllers\/cases_controller/, prefixes: ['02-', '03-'] },
  { pattern: /views\/core\/|controllers\/core_controller/, prefixes: ['04-'] },
  { pattern: /views\/layouts\/core|views\/layouts\/_header_core_app|views\/layouts\/_header\.html|controllers\/dropdown_controller|views\/dropdown\/cases|views\/layouts\/_footer_core_app/, prefixes: ['04-'] },
  { pattern: /queriesLayout\.html|queriesCtrl\.js|queries\.html/, prefixes: ['04-'] },
  { pattern: /query_list_controller\.js|query_row_controller\.js|add_query_controller\.js/, prefixes: ['04-'] },
  { pattern: /inline_edit_controller\.js|resizable_pane_controller\.js|settings_panel_controller\.js/, prefixes: ['04-'] },
  { pattern: /case_score_controller\.js|snapshot_controller\.js|clone_case_controller\.js|export_case_controller\.js|delete_case_options_controller\.js|judgements_controller\.js|import_ratings_controller\.js|snapshot_comparison_controller\.js|wizard_controller\.js|unarchive_controller\.js/, prefixes: ['04-'] },
  { pattern: /modules\/wizard_settings\.js|modules\/settings_validator\.js/, prefixes: ['04-'] },
  { pattern: /modules\/search_executor\.js|modules\/scorer|modules\/ratings_store|modules\/api_url|modules\/query_template|modules\/explain_parser|modules\/field_renderer/, prefixes: ['04-'] },
  { pattern: /doc_detail_modal_controller\.js|query_explain_modal_controller\.js|doc_finder_controller\.js/, prefixes: ['04-'] },
  { pattern: /paneSvc\.js|panes\.css/, prefixes: ['04-'] },
  { pattern: /components\/clone_case|components\/delete_case|components\/export_case|components\/import_ratings|components\/share_case|components\/judgements|components\/diff\//, prefixes: ['04e'] },
  { pattern: /search_results\.css|qscore_snapshot_diff\.css|animation_new_ui\.css|bootstrap3-add\.css|bootstrap5-add\.css|style\.css|base\.css/, prefixes: ['04-'] },
  { pattern: /views\/books\/|controllers\/books_controller/, prefixes: ['05-', '06-', '07-', '08-', '21-', '22-', '23-', '24-', '25-'] },
  { pattern: /views\/scorers\/|controllers\/scorers_controller/, prefixes: ['09-', '10-'] },
  { pattern: /views\/search_endpoints\//, prefixes: ['11-', '12-', '13-'] },
  { pattern: /views\/teams\/|controllers\/teams_controller/, prefixes: ['14-', '15-'] },
  { pattern: /views\/profiles\//, prefixes: ['16-'] },
  { pattern: /views\/admin\/|controllers\/admin\//, prefixes: ['18-', '19-', '20-'] },
  // Tool and config files that don't affect page appearance
  { pattern: /test\/visual_parity\//, prefixes: [] },
  { pattern: /vitest\.config|\.eslintrc|\.prettierrc|lefthook\.yml|\.github\/|docs\//, prefixes: [] },
  { pattern: /test\/javascript\//, prefixes: [] },
  { pattern: /vendor\/javascript\//, prefixes: [] },
  { pattern: /config\/importmap\.rb/, prefixes: [] },
];

/**
 * Determine which page name prefixes have changed since the last capture.
 * Returns null if all pages should be captured (no baseline or --all mode).
 * Returns a Set of prefixes if only some pages need recapturing.
 */
function detectChangedPrefixes() {
  if (ALL_MODE) return null;

  const lastCaptureFile = path.join(OUT_DIR, '.last_capture');
  if (!fs.existsSync(lastCaptureFile)) return null; // no baseline — capture all

  try {
    const lastCapture = fs.readFileSync(lastCaptureFile, 'utf-8').trim();
    // Validate timestamp format before using in shell command
    if (!/^\d{4}-\d{2}-\d{2}T[\d:.]+Z?$/.test(lastCapture)) {
      return null; // invalid format — capture all
    }
    // Check committed changes since last capture, uncommitted tracked changes, AND untracked new files
    const committedOutput = execSync(
      `git log --since="${lastCapture}" --name-only --pretty=format: HEAD 2>/dev/null`,
      { encoding: 'utf-8' }
    );
    const uncommittedOutput = execSync(
      `git diff --name-only HEAD 2>/dev/null`,
      { encoding: 'utf-8' }
    );
    const untrackedOutput = execSync(
      `git ls-files --others --exclude-standard 2>/dev/null`,
      { encoding: 'utf-8' }
    );
    // Only include uncommitted files whose modification time is after the last capture
    const lastCaptureTime = new Date(lastCapture).getTime();
    const localFiles = [
      ...uncommittedOutput.trim().split('\n').filter(Boolean),
      ...untrackedOutput.trim().split('\n').filter(Boolean),
    ];
    // Only include local files whose modification time is after the last capture
    const recentLocalFiles = localFiles.filter(f => {
      try {
        const stat = fs.statSync(f);
        return stat.mtimeMs > lastCaptureTime;
      } catch {
        return false; // deleted file — no screenshot impact
      }
    });
    const changedFiles = [...new Set([
      ...committedOutput.trim().split('\n').filter(Boolean),
      ...recentLocalFiles,
    ])];

    if (changedFiles.length === 0) {
      return new Set(); // nothing changed — skip everything
    }

    const prefixes = new Set();
    let unmapped = false;
    for (const file of changedFiles) {
      let mapped = false;
      for (const mapping of FILE_TO_PAGES) {
        if (mapping.pattern.test(file)) {
          mapping.prefixes.forEach(p => prefixes.add(p));
          mapped = true;
        }
      }
      if (!mapped) unmapped = true;
    }

    // If any changed file doesn't match a known pattern, capture all
    // to avoid missing something
    if (unmapped) return null;

    return prefixes;
  } catch {
    return null; // git failed — capture all
  }
}

// ---------------------------------------------------------------------------
// Filtering helpers
// ---------------------------------------------------------------------------
function matchesFilter(entry, filterStr) {
  if (!filterStr) return false;
  const patterns = filterStr.split(',').map(s => s.trim().toLowerCase());
  const entryName = entry.name.toLowerCase();
  const entryTags = (entry.tags || []).map(t => t.toLowerCase());
  return patterns.some(p =>
    entryName.includes(p) || entryTags.some(t => t.includes(p))
  );
}

function shouldCapture(entry, changedPrefixes) {
  if (ONLY_FILTER && !matchesFilter(entry, ONLY_FILTER)) return false;
  if (EXCLUDE_FILTER && matchesFilter(entry, EXCLUDE_FILTER)) return false;
  // If change detection produced a prefix set, only capture matching pages
  if (changedPrefixes !== null) {
    const matchesChange = [...changedPrefixes].some(p => entry.name.startsWith(p));
    if (!matchesChange) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Helper: fetch JSON from API via the authenticated browser page
// ---------------------------------------------------------------------------
async function fetchApiJson(page, apiPath) {
  await page.goto(`${BASE_URL}${apiPath}`, { waitUntil: 'networkidle' });
  const text = await page.evaluate(() => document.body.innerText);
  return JSON.parse(text);
}

// Cache for API lookups to avoid repeated calls
const apiCache = {};

async function getFirstCaseId(page) {
  if (apiCache.caseId) return apiCache.caseId;
  const data = await fetchApiJson(page, '/api/cases');
  const cases = data.all_cases || data.cases || [];
  if (cases.length > 0) {
    apiCache.caseId = cases[0].case_id || cases[0].id;
  }
  return apiCache.caseId;
}

async function getFirstBookId(page) {
  if (apiCache.bookId) return apiCache.bookId;
  const data = await fetchApiJson(page, '/api/books');
  const books = data.all_books || data.books || [];
  if (books.length > 0) {
    apiCache.bookId = books[0].book_id || books[0].id;
  }
  return apiCache.bookId;
}

async function getFirstSearchEndpointId(page) {
  if (apiCache.searchEndpointId) return apiCache.searchEndpointId;
  const data = await fetchApiJson(page, '/api/search_endpoints');
  const endpoints = data.search_endpoints || [];
  if (endpoints.length > 0) {
    apiCache.searchEndpointId = endpoints[0].search_endpoint_id || endpoints[0].id;
  }
  return apiCache.searchEndpointId;
}

async function getFirstTeamId(page) {
  if (apiCache.teamId) return apiCache.teamId;
  const data = await fetchApiJson(page, '/api/teams');
  const teams = data.teams || [];
  if (teams.length > 0) {
    apiCache.teamId = teams[0].id || teams[0].team_id;
  }
  return apiCache.teamId;
}

// ---------------------------------------------------------------------------
// Helpers for new-ui variant setup
// ---------------------------------------------------------------------------

// Resolve to the new_ui variant URL for the first case.
// Shared by all workspace variant entries to avoid duplication.
async function resolveNewUiCase(page) {
  const id = await getFirstCaseId(page);
  return id ? `/case/${id}/new_ui` : '/cases';
}

// Open the east pane on the new_ui layout by clicking "Tune Relevance".
// Waits for the pane to become visible before returning.
async function openNewUiPane(page) {
  await page.locator('a', { hasText: 'Tune Relevance' }).first().click();
  await page.locator('.pane_east').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 500));
}

// ---------------------------------------------------------------------------
// Page definitions
// ---------------------------------------------------------------------------
const PAGES = [
  // Unauthenticated
  { name: '00-login-page', path: '/sessions/new', noAuth: true, tags: ['auth'] },

  // Home / dashboard
  { name: '01-home-dashboard', path: '/', tags: ['home'] },

  // Cases
  { name: '02-cases-index', path: '/cases', tags: ['cases'] },
  { name: '03-cases-archived', path: '/cases?archived=true', tags: ['cases'] },

  // Case workspace
  {
    name: '04-case-workspace',
    tags: ['workspace'],
    resolve: async (page) => {
      const id = await getFirstCaseId(page);
      return id ? `/case/${id}` : '/cases';
    },
    variants: {
      'new-ui': { resolve: resolveNewUiCase },
    },
  },

  // Case workspace with first query expanded showing search results + toolbar
  // Uses Case 4 ("10s of Queries") which has 20 queries with ratings in the seed data.
  // Both Angular and new-ui setups follow the same sequence so the screenshots are
  // directly comparable: wait for query list → expand first query → wait for results
  // (or error) → scroll to top.
  {
    name: '04-case-workspace-expanded',
    tags: ['workspace', 'results'],
    path: '/case/4',
    setup: async (page) => {
      // Wait for Angular query list to render
      await page.waitForLoadState('networkidle');
      await new Promise(r => setTimeout(r, 3000));
      // Click the first query chevron to expand it
      const chevron = page.locator('.toggleSign').first();
      await chevron.waitFor({ state: 'visible', timeout: 10000 });
      await chevron.click();
      // Wait for search results or error to appear (matches new-ui selector strategy)
      await page.locator('.sub-results .result, .search-results-list, .alert-danger').first()
        .waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 2000));
      // Scroll to top so both variants capture from the same position
      await page.evaluate(() => window.scrollTo(0, 0));
      await new Promise(r => setTimeout(r, 500));
    },
    variants: {
      'new-ui': {
        path: '/case/4/new_ui',
        setup: async (page) => {
          await page.waitForLoadState('networkidle');
          await new Promise(r => setTimeout(r, 3000));
          // Scope to visible rows: paginated list marks off-page items with .d-none; unscoped .first() can hit a hidden row.
          const chevron = page
            .locator('#query-list-shell li:not(.d-none) [data-query-row-target="chevron"]')
            .first();
          await chevron.waitFor({ state: 'visible', timeout: 15000 });
          await chevron.click();
          // Wait for search results or error to appear (proxy may fail in VP Docker)
          await page.locator('.search-results-list, .alert-danger').first()
            .waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 2000));
          // Scroll to top so both variants capture from the same position
          await page.evaluate(() => window.scrollTo(0, 0));
          await new Promise(r => setTimeout(r, 500));
        },
      },
    },
  },

  // Case workspace — New UI (Rails+Stimulus replacement)
  {
    name: '04-case-workspace-new-ui',
    tags: ['workspace', 'new-ui'],
    resolve: async (page) => {
      const id = await getFirstCaseId(page);
      return id ? `/case/${id}/new_ui` : '/cases';
    },
    variants: {
      'new-ui': { resolve: resolveNewUiCase },
    },
  },

  // Case workspace — Tune Relevance pane tabs
  {
    name: '04a1-tune-relevance-query',
    tags: ['workspace', 'pane', 'tune-relevance'],
    resolve: async (page) => {
      const id = await getFirstCaseId(page);
      return id ? `/case/${id}` : '/cases';
    },
    setup: async (page) => {
      await page.locator('a', { hasText: 'Tune Relevance' }).first().click();
      await new Promise(r => setTimeout(r, 1500));
      // Query tab is the default when pane opens
    },
    variants: {
      'new-ui': {
        resolve: resolveNewUiCase,
        setup: async (page) => {
          await openNewUiPane(page);
          // Query tab is the default when pane opens
        },
      },
    },
  },
  {
    name: '04a2-tune-relevance-tuning-knobs',
    tags: ['workspace', 'pane', 'tune-relevance'],
    resolve: async (page) => {
      const id = await getFirstCaseId(page);
      return id ? `/case/${id}` : '/cases';
    },
    setup: async (page) => {
      await page.locator('a', { hasText: 'Tune Relevance' }).first().click();
      await new Promise(r => setTimeout(r, 1000));
      await page.locator('#curatorTab').click();
      await new Promise(r => setTimeout(r, 500));
    },
    variants: {
      'new-ui': {
        resolve: resolveNewUiCase,
        setup: async (page) => {
          await openNewUiPane(page);
          await page.locator('li[data-tab="tuning"]').click();
          await new Promise(r => setTimeout(r, 500));
        },
      },
    },
  },
  {
    name: '04a3-tune-relevance-settings',
    tags: ['workspace', 'pane', 'tune-relevance'],
    resolve: async (page) => {
      const id = await getFirstCaseId(page);
      return id ? `/case/${id}` : '/cases';
    },
    setup: async (page) => {
      await page.locator('a', { hasText: 'Tune Relevance' }).first().click();
      await new Promise(r => setTimeout(r, 1000));
      await page.locator('#engineTab').click();
      await new Promise(r => setTimeout(r, 500));
    },
    variants: {
      'new-ui': {
        resolve: resolveNewUiCase,
        setup: async (page) => {
          await openNewUiPane(page);
          await page.locator('li[data-tab="settings"]').click();
          await new Promise(r => setTimeout(r, 500));
        },
      },
    },
  },
  {
    name: '04a4-tune-relevance-history',
    tags: ['workspace', 'pane', 'tune-relevance'],
    resolve: async (page) => {
      const id = await getFirstCaseId(page);
      return id ? `/case/${id}` : '/cases';
    },
    setup: async (page) => {
      await page.locator('a', { hasText: 'Tune Relevance' }).first().click();
      await new Promise(r => setTimeout(r, 1000));
      await page.locator('#historyTab').click();
      await new Promise(r => setTimeout(r, 500));
    },
    variants: {
      'new-ui': {
        resolve: resolveNewUiCase,
        setup: async (page) => {
          await openNewUiPane(page);
          await page.locator('li[data-tab="history"]').click();
          await new Promise(r => setTimeout(r, 500));
        },
      },
    },
  },
  {
    name: '04a5-tune-relevance-annotations',
    tags: ['workspace', 'pane', 'tune-relevance'],
    resolve: async (page) => {
      const id = await getFirstCaseId(page);
      return id ? `/case/${id}` : '/cases';
    },
    setup: async (page) => {
      await page.locator('a', { hasText: 'Tune Relevance' }).first().click();
      await new Promise(r => setTimeout(r, 1000));
      await page.locator('#annotationsTab').click();
      await new Promise(r => setTimeout(r, 500));
    },
    variants: {
      'new-ui': {
        resolve: resolveNewUiCase,
        setup: async (page) => {
          await openNewUiPane(page);
          await page.locator('li[data-tab="annotations"]').click();
          await new Promise(r => setTimeout(r, 1500));  // extra time for lazy-loaded annotation fetch
        },
      },
    },
  },

  // Case workspace — action bar modals
  // Each modal page defines a new-ui variant so route comparison (--routes)
  // captures the same modals on both the Angular and Stimulus layouts.
  // The modal setup logic is identical because the action bar and Angular
  // modal components are shared between both layouts during the migration.
  {
    name: '04e1-modal-select-scorer',
    tags: ['workspace', 'action-bar', 'modal'],
    resolve: async (page) => {
      const id = await getFirstCaseId(page);
      return id ? `/case/${id}` : '/cases';
    },
    setup: async (page) => {
      await page.locator('#case-actions a', { hasText: 'Select scorer' }).click();
      await page.locator('.modal').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 500));
    },
    variants: {
      'new-ui': { resolve: resolveNewUiCase },
    },
  },
  {
    name: '04e2-modal-judgements',
    tags: ['workspace', 'action-bar', 'modal'],
    resolve: async (page) => {
      const id = await getFirstCaseId(page);
      return id ? `/case/${id}` : '/cases';
    },
    setup: async (page) => {
      // Wait for Stimulus controllers to connect (importmap async loading)
      await new Promise(r => setTimeout(r, 2000));
      await page.locator('#case-actions a', { hasText: 'Judgements' }).click();
      await page.locator('.modal.show').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 500));
    },
    variants: {
      'new-ui': { resolve: resolveNewUiCase },
    },
  },
  {
    name: '04e3-modal-create-snapshot',
    tags: ['workspace', 'action-bar', 'modal'],
    resolve: async (page) => {
      const id = await getFirstCaseId(page);
      return id ? `/case/${id}` : '/cases';
    },
    setup: async (page) => {
      await page.locator('#case-actions a', { hasText: 'Create snapshot' }).click();
      await page.locator('.modal').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 500));
    },
    variants: {
      'new-ui': { resolve: resolveNewUiCase },
    },
  },
  {
    name: '04e4-modal-compare-snapshots',
    tags: ['workspace', 'action-bar', 'modal'],
    resolve: async (page) => {
      const id = await getFirstCaseId(page);
      return id ? `/case/${id}` : '/cases';
    },
    setup: async (page) => {
      // Wait for Stimulus controllers to connect (importmap async loading)
      await new Promise(r => setTimeout(r, 2000));
      await page.locator('#case-actions a', { hasText: 'Compare snapshots' }).click();
      await page.locator('.modal.show').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      // Wait for snapshot list to load (API fetch inside the modal)
      await new Promise(r => setTimeout(r, 2000));
    },
    variants: {
      'new-ui': { resolve: resolveNewUiCase },
    },
  },
  {
    name: '04e5-modal-import',
    tags: ['workspace', 'action-bar', 'modal'],
    resolve: async (page) => {
      const id = await getFirstCaseId(page);
      return id ? `/case/${id}` : '/cases';
    },
    setup: async (page) => {
      // Wait for Stimulus controllers to connect (importmap async loading)
      await new Promise(r => setTimeout(r, 2000));
      await page.locator('#case-actions a', { hasText: 'Import' }).click();
      await page.locator('.modal.show').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 500));
    },
    variants: {
      'new-ui': { resolve: resolveNewUiCase },
    },
  },
  {
    name: '04e6-modal-share-case',
    tags: ['workspace', 'action-bar', 'modal'],
    resolve: async (page) => {
      const id = await getFirstCaseId(page);
      return id ? `/case/${id}` : '/cases';
    },
    setup: async (page) => {
      await page.locator('#case-actions a', { hasText: 'Share case' }).click();
      await page.locator('.modal').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 500));
    },
    variants: {
      'new-ui': { resolve: resolveNewUiCase },
    },
  },
  {
    name: '04e7-modal-clone',
    tags: ['workspace', 'action-bar', 'modal'],
    resolve: async (page) => {
      const id = await getFirstCaseId(page);
      return id ? `/case/${id}` : '/cases';
    },
    setup: async (page) => {
      await page.locator('#case-actions a', { hasText: 'Clone' }).click();
      await page.locator('.modal').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 500));
    },
    variants: {
      'new-ui': { resolve: resolveNewUiCase },
    },
  },
  {
    name: '04e8-modal-delete',
    tags: ['workspace', 'action-bar', 'modal'],
    resolve: async (page) => {
      const id = await getFirstCaseId(page);
      return id ? `/case/${id}` : '/cases';
    },
    setup: async (page) => {
      await page.locator('#case-actions a', { hasText: 'Delete' }).click();
      await page.locator('.modal').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 500));
    },
    variants: {
      'new-ui': { resolve: resolveNewUiCase },
    },
  },
  {
    name: '04e9-modal-export',
    tags: ['workspace', 'action-bar', 'modal'],
    resolve: async (page) => {
      const id = await getFirstCaseId(page);
      return id ? `/case/${id}` : '/cases';
    },
    setup: async (page) => {
      // Wait for Stimulus controllers to connect (importmap async loading)
      await new Promise(r => setTimeout(r, 2000));
      await page.locator('#case-actions a', { hasText: 'Export' }).click();
      await page.locator('.modal.show').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 500));
    },
    variants: {
      'new-ui': { resolve: resolveNewUiCase },
    },
  },

  // Case workspace — Wizard modal (new-ui only, triggered by ?showWizard=true)
  {
    name: '04e10-modal-wizard',
    tags: ['workspace', 'action-bar', 'modal', 'new-ui'],
    resolve: async (page) => {
      const id = await getFirstCaseId(page);
      return id ? `/case/${id}/new_ui?showWizard=true` : '/cases';
    },
    setup: async (page) => {
      // Wait for wizard modal to auto-open (300ms delay + rendering)
      await page.locator('.modal.show').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 1000));
    },
    // Base resolve already points to new_ui; variant inherits it
    variants: { 'new-ui': {} },
  },

  // Case workspace — Archived case with unarchive button (new-ui only)
  {
    name: '04f-case-workspace-archived',
    tags: ['workspace', 'new-ui'],
    resolve: async (page) => {
      const id = await getFirstCaseId(page);
      return id ? `/case/${id}/new_ui` : '/cases';
    },
    setup: async (page) => {
      // Archive the case via API, then reload so the page shows the ARCHIVED badge
      const token = await page.evaluate(() =>
        document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
      );
      const caseId = await page.evaluate(() => document.body.dataset.caseId);
      if (caseId && token) {
        await page.evaluate(async ([id, csrf]) => {
          await fetch(`/api/cases/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, Accept: 'application/json' },
            body: JSON.stringify({ case: { archived: true } }),
          });
        }, [caseId, token]);
        await page.reload({ waitUntil: 'networkidle' });
        await new Promise(r => setTimeout(r, 1000));
      }
    },
    teardown: async (page) => {
      // Unarchive the case to restore sample data state
      const token = await page.evaluate(() =>
        document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
      );
      const caseId = await page.evaluate(() => document.body.dataset.caseId);
      if (caseId && token) {
        await page.evaluate(async ([id, csrf]) => {
          await fetch(`/api/cases/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, Accept: 'application/json' },
            body: JSON.stringify({ case: { archived: false } }),
          });
        }, [caseId, token]);
      }
    },
    // Base resolve already points to new_ui; variant inherits it
    variants: { 'new-ui': {} },
  },

  // Case workspace — header dropdowns open
  {
    name: '04b-case-workspace-cases-dropdown',
    tags: ['workspace', 'header', 'dropdown'],
    resolve: async (page) => {
      const id = await getFirstCaseId(page);
      return id ? `/case/${id}` : '/cases';
    },
    setup: async (page) => {
      const toggle = page.locator('.dropdown-toggle', { hasText: 'Relevancy Cases' }).first();
      await toggle.click();
      await new Promise(r => setTimeout(r, 1000));
    },
    variants: {
      // Header is the same shared partial — setup inherited
      'new-ui': { resolve: resolveNewUiCase },
    },
  },
  {
    name: '04c-case-workspace-books-dropdown',
    tags: ['workspace', 'header', 'dropdown'],
    resolve: async (page) => {
      const id = await getFirstCaseId(page);
      return id ? `/case/${id}` : '/cases';
    },
    setup: async (page) => {
      const toggle = page.locator('.dropdown-toggle', { hasText: 'Books' }).first();
      await toggle.click();
      await new Promise(r => setTimeout(r, 1000));
    },
    variants: {
      'new-ui': { resolve: resolveNewUiCase },
    },
  },
  {
    name: '04d-case-workspace-user-dropdown',
    tags: ['workspace', 'header', 'dropdown'],
    resolve: async (page) => {
      const id = await getFirstCaseId(page);
      return id ? `/case/${id}` : '/cases';
    },
    setup: async (page) => {
      const toggle = page.locator('.dropdown-toggle [data-display-name]').first();
      await toggle.click();
      await new Promise(r => setTimeout(r, 1000));
    },
    variants: {
      'new-ui': { resolve: resolveNewUiCase },
    },
  },

  // Books
  { name: '05-books-index', path: '/books', tags: ['books'] },
  {
    name: '06-book-show',
    tags: ['books'],
    resolve: async (page) => {
      const id = await getFirstBookId(page);
      return id ? `/books/${id}` : '/books';
    },
  },
  { name: '07-book-new', path: '/books/new', tags: ['books'] },
  {
    name: '08-book-edit',
    tags: ['books'],
    resolve: async (page) => {
      const id = await getFirstBookId(page);
      return id ? `/books/${id}/edit` : '/books';
    },
  },

  // Scorers
  { name: '09-scorers-index', path: '/scorers', tags: ['scorers'] },
  { name: '10-scorers-new', path: '/scorers/new', tags: ['scorers'] },

  // Search Endpoints
  { name: '11-search-endpoints-index', path: '/search_endpoints', tags: ['endpoints'] },
  { name: '12-search-endpoints-new', path: '/search_endpoints/new', tags: ['endpoints'] },
  {
    name: '13-search-endpoint-show',
    tags: ['endpoints'],
    resolve: async (page) => {
      const id = await getFirstSearchEndpointId(page);
      return id ? `/search_endpoints/${id}` : '/search_endpoints';
    },
  },

  // Teams
  { name: '14-teams-index', path: '/teams', tags: ['teams'] },
  {
    name: '15-team-show',
    tags: ['teams'],
    resolve: async (page) => {
      const id = await getFirstTeamId(page);
      return id ? `/teams/${id}` : '/teams';
    },
  },

  // Profile
  { name: '16-profile', path: '/profile', tags: ['profile'] },

  // Analytics
  {
    name: '17-analytics-tries',
    tags: ['analytics'],
    resolve: async (page) => {
      const id = await getFirstCaseId(page);
      return id ? `/analytics/tries_visualization/${id}` : '/cases';
    },
  },

  // Admin pages
  { name: '18-admin-dashboard', path: '/admin', tags: ['admin'] },
  { name: '19-admin-users', path: '/admin/users', tags: ['admin'] },
  { name: '20-admin-announcements', path: '/admin/announcements', tags: ['admin'] },

  // Book sub-pages
  {
    name: '21-query-doc-pairs',
    tags: ['books'],
    resolve: async (page) => {
      const id = await getFirstBookId(page);
      return id ? `/books/${id}/query_doc_pairs` : '/books';
    },
  },
  {
    name: '22-book-judgements',
    tags: ['books'],
    resolve: async (page) => {
      const id = await getFirstBookId(page);
      return id ? `/books/${id}/judgements` : '/books';
    },
  },
  {
    name: '23-book-judge',
    tags: ['books'],
    resolve: async (page) => {
      const id = await getFirstBookId(page);
      return id ? `/books/${id}/judge` : '/books';
    },
  },
  {
    name: '24-book-export',
    tags: ['books'],
    resolve: async (page) => {
      const id = await getFirstBookId(page);
      return id ? `/books/${id}/export` : '/books';
    },
  },
  {
    name: '25-book-judgement-stats',
    tags: ['books'],
    resolve: async (page) => {
      const id = await getFirstBookId(page);
      return id ? `/books/${id}/judgement_stats` : '/books';
    },
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // ---- List mode ----
  if (LIST_MODE) {
    console.log('\nAvailable screenshots:\n');
    const allTags = new Set();
    const allVariants = new Set();
    for (const entry of PAGES) {
      const tags = (entry.tags || []).join(', ');
      const variantNames = entry.variants ? Object.keys(entry.variants).join(', ') : '';
      const variantNote = variantNames ? `  variants: ${variantNames}` : '';
      console.log(`  ${entry.name}${tags ? `  [${tags}]` : ''}${variantNote}`);
      (entry.tags || []).forEach(t => allTags.add(t));
      if (entry.variants) Object.keys(entry.variants).forEach(v => allVariants.add(v));
    }
    console.log(`\nAvailable tags: ${[...allTags].sort().join(', ')}`);
    if (allVariants.size > 0) {
      console.log(`Available variants: ${[...allVariants].sort().join(', ')}`);
    }
    console.log('');
    return;
  }

  // Detect which pages need recapturing based on git changes since last run.
  // Returns null if all pages should be captured, or a Set of name prefixes.
  const changedPrefixes = detectChangedPrefixes();

  let filteredPages = PAGES.filter(p => shouldCapture(p, changedPrefixes));

  if (VARIANT) {
    // In variant mode, only capture pages that define this variant
    filteredPages = filteredPages.filter(p => p.variants && p.variants[VARIANT]);
  }

  if (filteredPages.length === 0) {
    if (changedPrefixes !== null && changedPrefixes.size === 0) {
      console.log('No code changes detected since last capture. Use --all to force recapture.');
    } else {
      console.log('No pages match the filter. Use --list to see available names and tags.');
    }
    return;
  }

  if (changedPrefixes !== null && changedPrefixes.size > 0) {
    console.log(`   Changed prefixes: ${[...changedPrefixes].sort().join(', ')}`);
  }

  // Clean only screenshot files that will be recaptured, so that unchanged
  // pages keep their prior screenshots in the report.
  if (fs.existsSync(OUT_DIR)) {
    const pagesToCapture = new Set(filteredPages.map(p => p.name));
    for (const file of fs.readdirSync(OUT_DIR)) {
      if (file.endsWith('.png') || file.endsWith('-ERROR.txt')) {
        const baseName = file.replace(/\.png$/, '').replace(/-ERROR\.txt$/, '');
        if (pagesToCapture.has(baseName)) {
          fs.unlinkSync(path.join(OUT_DIR, file));
        }
      }
    }
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const filterNote = ONLY_FILTER ? ` (only: ${ONLY_FILTER})`
                   : EXCLUDE_FILTER ? ` (exclude: ${EXCLUDE_FILTER})`
                   : '';
  const variantNote = VARIANT ? ` (variant: ${VARIANT})` : '';
  console.log(`\n📸 Capturing screenshots for branch: ${BRANCH}${filterNote}${variantNote}`);
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Label:    ${LABEL}`);
  console.log(`   User:     ${LOGIN_EMAIL}`);
  console.log(`   Output:   ${OUT_DIR}`);
  const changeNote = changedPrefixes !== null
    ? ` (${changedPrefixes.size > 0 ? 'changed only' : 'none changed'})`
    : ALL_MODE ? ' (--all)' : '';
  console.log(`   Pages:    ${filteredPages.length} of ${PAGES.length}${changeNote}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // ---- Capture unauthenticated pages first ----
  for (const entry of filteredPages.filter(p => p.noAuth)) {
    await captureScreenshot(page, entry);
  }

  // ---- Log in ----
  console.log('🔑 Logging in...');
  await page.goto(`${BASE_URL}/sessions/new`, { waitUntil: 'networkidle' });
  // Scope to the #login form to avoid duplicate IDs with signup form
  const loginForm = page.locator('form#login');
  await loginForm.locator('input[name="user[email]"]').fill(LOGIN_EMAIL);
  await loginForm.locator('input[name="user[password]"]').fill(LOGIN_PASSWORD);
  await loginForm.locator('input[type="submit"]').click();
  await page.waitForLoadState('networkidle');
  // Verify we're no longer on the login page (login succeeded)
  const url = page.url();
  if (url.includes('/sessions/new') || url.includes('/sessions')) {
    const hasError = await page.locator('#error_explanation, .alert-danger').isVisible();
    const msg = hasError
      ? 'Login failed (invalid credentials or form error). Use --email and --password for a seeded user (e.g. quepid+realisticactivity@o19s.com / password).'
      : 'Login may have failed; still on login page after submit.';
    throw new Error(msg);
  }
  console.log('   ✅ Logged in\n');

  // ---- Capture authenticated pages ----
  for (const entry of filteredPages.filter(p => !p.noAuth)) {
    await captureScreenshot(page, entry);
  }

  await browser.close();

  // Write timestamp so the report generator can flag changes since last capture
  fs.writeFileSync(path.join(OUT_DIR, '.last_capture'), new Date().toISOString());

  console.log(`\n✅ Done! ${filteredPages.length} screenshots saved to ${OUT_DIR}\n`);
}

async function captureScreenshot(page, entry) {
  const { name } = entry;

  // When running in variant mode, merge variant overrides (resolve, setup, path)
  // onto the base entry so the variant's URL and interactions are used.
  const effective = VARIANT && entry.variants?.[VARIANT]
    ? { ...entry, ...entry.variants[VARIANT] }
    : entry;

  let urlPath = effective.path;

  try {
    // Resolve dynamic paths
    if (!urlPath && effective.resolve) {
      urlPath = await effective.resolve(page);
    }

    const fullUrl = `${BASE_URL}${urlPath}`;
    console.log(`  📷 ${name} → ${urlPath}`);
    await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait a bit for JS rendering (avoid deprecated waitForTimeout)
    await new Promise(r => setTimeout(r, 1500));

    // Run optional setup (uses variant setup if provided, otherwise base entry setup)
    if (effective.setup) {
      await effective.setup(page);
    }

    // Wait for specific selector if given
    if (effective.waitFor) {
      await page.waitForSelector(effective.waitFor, { timeout: 10000 }).catch(() => {});
    }

    const filePath = path.join(OUT_DIR, `${name}.png`);
    await page.screenshot({ path: filePath, fullPage: true });
  } catch (err) {
    console.error(`  ❌ ${name}: ${err.message}`);
    // Save an error placeholder
    const filePath = path.join(OUT_DIR, `${name}-ERROR.txt`);
    fs.writeFileSync(filePath, `Error capturing ${name}: ${err.message}\n`);
  } finally {
    // Always run teardown (e.g., unarchive a case) even if setup/screenshot failed,
    // so destructive setup steps don't corrupt sample data for subsequent captures.
    if (effective.teardown) {
      try {
        await effective.teardown(page);
      } catch (teardownErr) {
        console.error(`  ⚠️  ${name} teardown failed: ${teardownErr.message}`);
      }
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
