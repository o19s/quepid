/**
 * API Structure Comparison
 *
 * Hits key JSON API endpoints, saves the response key structures
 * (not values) per branch, then diffs them for structural parity.
 *
 * Usage:
 *   node test/visual_parity/compare_apis.mjs --branch <branch_name>
 *   node test/visual_parity/compare_apis.mjs --diff
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
const hasFlag = (name) => args.includes(`--${name}`);

const BRANCH   = getArg('branch', 'unknown');
const BASE_URL = getArg('base-url', 'http://localhost:3000');
const OUT_DIR  = path.join(__dirname, 'api_structures');

const LOGIN_EMAIL    = getArg('email', 'random@example.com');
const LOGIN_PASSWORD = getArg('password', 'password');

// ---------------------------------------------------------------------------
// API Endpoints to compare
// ---------------------------------------------------------------------------
const ENDPOINTS = [
  { name: 'cases',            path: '/api/cases' },
  { name: 'books',            path: '/api/books' },
  { name: 'scorers',          path: '/api/scorers' },
  { name: 'teams',            path: '/api/teams' },
  { name: 'search_endpoints', path: '/api/search_endpoints' },
  { name: 'current_user',     path: '/api/users/current' },
  { name: 'announcements',    path: '/api/announcements' },
  // Dynamic endpoints – first item from list endpoints
  {
    name: 'case_detail',
    resolve: async (fetcher) => {
      const resp = await fetcher('/api/cases');
      const data = JSON.parse(resp);
      const cases = data.all_cases || data.cases || data;
      if (Array.isArray(cases) && cases.length > 0) {
        const id = cases[0].case_id || cases[0].id;
        return `/api/cases/${id}`;
      }
      return null;
    },
  },
  {
    name: 'book_detail',
    resolve: async (fetcher) => {
      const resp = await fetcher('/api/books');
      const data = JSON.parse(resp);
      const books = data.all_books || data.books || data;
      if (Array.isArray(books) && books.length > 0) {
        return `/api/books/${books[0].book_id || books[0].id}`;
      }
      return null;
    },
  },
  {
    name: 'team_detail',
    resolve: async (fetcher) => {
      const resp = await fetcher('/api/teams');
      const data = JSON.parse(resp);
      const teams = data.teams || data;
      if (Array.isArray(teams) && teams.length > 0) {
        return `/api/teams/${teams[0].id || teams[0].team_id}`;
      }
      return null;
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract nested key structure from a JSON value */
function extractKeyStructure(value) {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    // Extract structure from first element only
    return [extractKeyStructure(value[0])];
  }
  if (typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value).sort()) {
      result[key] = extractKeyStructure(value[key]);
    }
    return result;
  }
  return typeof value; // 'string', 'number', 'boolean'
}

/** Deep diff two key structures */
function diffStructures(a, b, prefix = '') {
  const diffs = [];

  if (typeof a !== typeof b) {
    diffs.push({ path: prefix || '(root)', left: typeof a, right: typeof b });
    return diffs;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length > 0 && b.length > 0) {
      diffs.push(...diffStructures(a[0], b[0], `${prefix}[0]`));
    }
    return diffs;
  }

  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
    const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of [...allKeys].sort()) {
      const childPath = prefix ? `${prefix}.${key}` : key;
      if (!(key in a)) {
        diffs.push({ path: childPath, left: '(missing)', right: typeof b[key] === 'object' ? JSON.stringify(b[key]) : b[key] });
      } else if (!(key in b)) {
        diffs.push({ path: childPath, left: typeof a[key] === 'object' ? JSON.stringify(a[key]) : a[key], right: '(missing)' });
      } else {
        diffs.push(...diffStructures(a[key], b[key], childPath));
      }
    }
    return diffs;
  }

  if (a !== b) {
    diffs.push({ path: prefix || '(root)', left: a, right: b });
  }

  return diffs;
}

// ---------------------------------------------------------------------------
// Capture mode
// ---------------------------------------------------------------------------
async function capture() {
  fs.mkdirSync(path.join(OUT_DIR, BRANCH), { recursive: true });

  console.log(`\n🔌 Capturing API structures for branch: ${BRANCH}`);
  console.log(`   Base URL: ${BASE_URL}\n`);

  // Login to get session cookie
  console.log('🔑 Logging in...');

  // Get CSRF token from login page
  const loginHtml = await fetch(`${BASE_URL}/sessions/new`).then(r => r.text());
  // Match the CSRF token from the #login form specifically
  const loginFormMatch = loginHtml.match(/id="login"[^>]*>.*?name="authenticity_token"\s+value="([^"]+)"/s);
  // Fallback: grab the first authenticity_token inside form#login
  const csrfMatch = loginFormMatch || loginHtml.match(/name="authenticity_token"[^>]*value="([^"]+)"/);
  const csrf = csrfMatch ? csrfMatch[1] : '';

  // Submit login form
  const formData = new URLSearchParams();
  formData.append('authenticity_token', csrf);
  formData.append('user[email]', LOGIN_EMAIL);
  formData.append('user[password]', LOGIN_PASSWORD);

  const sessionResp = await fetch(`${BASE_URL}/users/login`, {
    method: 'POST',
    body: formData,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    redirect: 'manual',
  });

  const cookies = sessionResp.headers.getSetCookie?.() || [];
  const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');

  if (!cookieHeader) {
    console.error('❌ Login failed – no session cookie received');
    process.exit(1);
  }
  console.log('   ✅ Logged in\n');

  // Authenticated fetcher
  const fetcher = async (apiPath) => {
    const resp = await fetch(`${BASE_URL}${apiPath}`, {
      headers: {
        'Cookie': cookieHeader,
        'Accept': 'application/json',
      },
    });
    return resp.text();
  };

  // Capture each endpoint
  for (const endpoint of ENDPOINTS) {
    let apiPath = endpoint.path;
    const name = endpoint.name;

    try {
      if (!apiPath && endpoint.resolve) {
        apiPath = await endpoint.resolve(fetcher);
        if (!apiPath) {
          console.log(`  ⏭️  ${name}: skipped (no data)`);
          continue;
        }
      }

      console.log(`  📡 ${name} → ${apiPath}`);
      const body = await fetcher(apiPath);
      const json = JSON.parse(body);
      const structure = extractKeyStructure(json);

      const outPath = path.join(OUT_DIR, BRANCH, `${name}.json`);
      fs.writeFileSync(outPath, JSON.stringify(structure, null, 2));
    } catch (err) {
      console.error(`  ❌ ${name}: ${err.message}`);
    }
  }

  console.log(`\n✅ API structures saved to ${path.join(OUT_DIR, BRANCH)}\n`);
}

// ---------------------------------------------------------------------------
// Diff mode
// ---------------------------------------------------------------------------
function diff() {
  console.log('\n📊 Comparing API structures...\n');

  const branches = fs.readdirSync(OUT_DIR).filter(d =>
    fs.statSync(path.join(OUT_DIR, d)).isDirectory()
  );

  if (branches.length < 2) {
    console.error('Need at least 2 branch captures to diff. Run --capture for each branch first.');
    process.exit(1);
  }

  const [branchA, branchB] = branches.sort();
  console.log(`  Comparing: ${branchA} ↔ ${branchB}\n`);

  const filesA = fs.readdirSync(path.join(OUT_DIR, branchA)).filter(f => f.endsWith('.json'));
  const filesB = new Set(fs.readdirSync(path.join(OUT_DIR, branchB)).filter(f => f.endsWith('.json')));

  let totalDiffs = 0;
  const report = [];

  for (const file of filesA) {
    const name = file.replace('.json', '');
    if (!filesB.has(file)) {
      console.log(`  ⚠️  ${name}: only in ${branchA}`);
      report.push({ endpoint: name, status: 'missing_right', diffs: [] });
      totalDiffs++;
      continue;
    }

    const structA = JSON.parse(fs.readFileSync(path.join(OUT_DIR, branchA, file), 'utf-8'));
    const structB = JSON.parse(fs.readFileSync(path.join(OUT_DIR, branchB, file), 'utf-8'));

    const diffs = diffStructures(structA, structB);
    if (diffs.length === 0) {
      console.log(`  ✅ ${name}: identical`);
      report.push({ endpoint: name, status: 'identical', diffs: [] });
    } else {
      console.log(`  ❌ ${name}: ${diffs.length} difference(s)`);
      for (const d of diffs) {
        console.log(`      ${d.path}: ${d.left} → ${d.right}`);
      }
      report.push({ endpoint: name, status: 'different', diffs });
      totalDiffs += diffs.length;
    }
  }

  // Check for files only in branchB
  for (const file of filesB) {
    if (!filesA.includes(file)) {
      const name = file.replace('.json', '');
      console.log(`  ⚠️  ${name}: only in ${branchB}`);
      report.push({ endpoint: name, status: 'missing_left', diffs: [] });
      totalDiffs++;
    }
  }

  // Save report JSON
  fs.writeFileSync(
    path.join(OUT_DIR, 'api_diff_report.json'),
    JSON.stringify({ branchA, branchB, report }, null, 2)
  );

  console.log(`\n${totalDiffs === 0 ? '✅' : '⚠️'}  Total differences: ${totalDiffs}`);
  console.log(`   Report saved to ${path.join(OUT_DIR, 'api_diff_report.json')}\n`);
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------
if (hasFlag('diff')) {
  diff();
} else {
  capture().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
