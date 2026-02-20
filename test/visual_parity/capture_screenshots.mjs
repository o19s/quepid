/**
 * Visual Parity Screenshot Capture
 *
 * Logs into Quepid and captures full-page screenshots of every significant view.
 *
 * Usage:
 *   node test/visual_parity/capture_screenshots.mjs --branch <branch_name>
 *   node test/visual_parity/capture_screenshots.mjs --branch deangularjs --base-url http://localhost:3000
 *   node test/visual_parity/capture_screenshots.mjs --branch deangularjs --email admin@example.com
 */

import { chromium } from '@playwright/test';
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
const OUT_DIR  = path.join(__dirname, 'screenshots', BRANCH);

const LOGIN_EMAIL    = getArg('email', 'quepid+realisticactivity@o19s.com');
const LOGIN_PASSWORD = getArg('password', 'password');

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
// Page definitions
// ---------------------------------------------------------------------------
const PAGES = [
  // Unauthenticated
  { name: '00-login-page', path: '/sessions/new', noAuth: true },

  // Home / dashboard
  { name: '01-home-dashboard', path: '/' },

  // Cases
  { name: '02-cases-index', path: '/cases' },
  { name: '03-cases-archived', path: '/cases?archived=true' },

  // Case workspace
  {
    name: '04-case-workspace',
    resolve: async (page) => {
      const id = await getFirstCaseId(page);
      return id ? `/case/${id}` : '/cases';
    },
  },

  // Books
  { name: '05-books-index', path: '/books' },
  {
    name: '06-book-show',
    resolve: async (page) => {
      const id = await getFirstBookId(page);
      return id ? `/books/${id}` : '/books';
    },
  },
  { name: '07-book-new', path: '/books/new' },
  {
    name: '08-book-edit',
    resolve: async (page) => {
      const id = await getFirstBookId(page);
      return id ? `/books/${id}/edit` : '/books';
    },
  },

  // Scorers
  { name: '09-scorers-index', path: '/scorers' },
  { name: '10-scorers-new', path: '/scorers/new' },

  // Search Endpoints
  { name: '11-search-endpoints-index', path: '/search_endpoints' },
  { name: '12-search-endpoints-new', path: '/search_endpoints/new' },
  {
    name: '13-search-endpoint-show',
    resolve: async (page) => {
      const id = await getFirstSearchEndpointId(page);
      return id ? `/search_endpoints/${id}` : '/search_endpoints';
    },
  },

  // Teams
  { name: '14-teams-index', path: '/teams' },
  {
    name: '15-team-show',
    resolve: async (page) => {
      const id = await getFirstTeamId(page);
      return id ? `/teams/${id}` : '/teams';
    },
  },

  // Profile
  { name: '16-profile', path: '/profile' },

  // Analytics – tries visualization (Rails route: /analytics/tries_visualization/:case_id)
  {
    name: '17-analytics-tries',
    resolve: async (page) => {
      const id = await getFirstCaseId(page);
      return id ? `/analytics/tries_visualization/${id}` : '/cases';
    },
  },

  // Admin pages
  { name: '18-admin-dashboard', path: '/admin' },
  { name: '19-admin-users', path: '/admin/users' },
  { name: '20-admin-announcements', path: '/admin/announcements' },

  // Book sub-pages
  {
    name: '21-query-doc-pairs',
    resolve: async (page) => {
      const id = await getFirstBookId(page);
      return id ? `/books/${id}/query_doc_pairs` : '/books';
    },
  },
  {
    name: '22-book-judgements',
    resolve: async (page) => {
      const id = await getFirstBookId(page);
      return id ? `/books/${id}/judgements` : '/books';
    },
  },
  {
    name: '23-book-judge',
    resolve: async (page) => {
      const id = await getFirstBookId(page);
      return id ? `/books/${id}/judge` : '/books';
    },
  },
  {
    name: '24-book-export',
    resolve: async (page) => {
      const id = await getFirstBookId(page);
      return id ? `/books/${id}/export` : '/books';
    },
  },
  {
    name: '25-book-judgement-stats',
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
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`\n📸 Capturing screenshots for branch: ${BRANCH}`);
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   User:     ${LOGIN_EMAIL}`);
  console.log(`   Output:   ${OUT_DIR}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // ---- Capture unauthenticated pages first ----
  for (const entry of PAGES.filter(p => p.noAuth)) {
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
  for (const entry of PAGES.filter(p => !p.noAuth)) {
    await captureScreenshot(page, entry);
  }

  await browser.close();
  console.log(`\n✅ Done! ${PAGES.length} screenshots saved to ${OUT_DIR}\n`);
}

async function captureScreenshot(page, entry) {
  const { name } = entry;
  let urlPath = entry.path;

  try {
    // Resolve dynamic paths
    if (!urlPath && entry.resolve) {
      urlPath = await entry.resolve(page);
    }

    const fullUrl = `${BASE_URL}${urlPath}`;
    console.log(`  📷 ${name} → ${urlPath}`);
    await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait a bit for JS rendering (avoid deprecated waitForTimeout)
    await new Promise(r => setTimeout(r, 1500));

    // Run optional setup
    if (entry.setup) {
      await entry.setup(page);
    }

    // Wait for specific selector if given
    if (entry.waitFor) {
      await page.waitForSelector(entry.waitFor, { timeout: 10000 }).catch(() => {});
    }

    const filePath = path.join(OUT_DIR, `${name}.png`);
    await page.screenshot({ path: filePath, fullPage: true });
  } catch (err) {
    console.error(`  ❌ ${name}: ${err.message}`);
    // Save an error placeholder
    const filePath = path.join(OUT_DIR, `${name}-ERROR.txt`);
    fs.writeFileSync(filePath, `Error capturing ${name}: ${err.message}\n`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
