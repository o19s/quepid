#!/usr/bin/env node

// Builds the esbuild bundles into app/assets/builds/. Usage:
//   node esbuild.config.js <core-case|core-vendor|analytics>... [--watch[=forever]]
// See docs/js_pipeline.md for how these bundles relate to the importmap.

const esbuild = require('esbuild');

const SHARED = {
  bundle: true,
  sourcemap: true,
  format: 'iife',
  platform: 'browser',
  publicPath: '/assets',
};

const JS = 'app/javascript';

const BUNDLES = {
  // Core case page (Stimulus controllers + runtime modules).
  'core-case': {
    entryPoints: [`${JS}/core_stimulus.js`],
    outfile: 'app/assets/builds/core_case.js',
    // Bare specifiers used by core code; the importmap resolves these for Rails pages.
    alias: {
      controllers: `./${JS}/controllers`,
      utils: `./${JS}/utils`,
      stores: `./${JS}/stores`,
      api: `./${JS}/api`,
      modules: `./${JS}/modules`,
      core_runtime: `./${JS}/core_runtime.js`,
      quepid_search: `./${JS}/quepid_search.js`,
      quepid_store: `./${JS}/quepid_store.js`
    }
  },
  // Third-party globals (Ace, Sortable, Shepherd, splainer-search, ...).
  'core-vendor': {
    entryPoints: [`${JS}/core_vendor.js`],
    outdir: 'app/assets/builds',
    loader: {
      '.css': 'css',
      '.png': 'dataurl',
      '.svg': 'dataurl',
      '.woff': 'dataurl',
      '.woff2': 'dataurl',
      '.ttf': 'dataurl',
      '.eot': 'dataurl'
    },
    alias: { utils: `./${JS}/utils`, api: `./${JS}/api` }
  },
  analytics: {
    entryPoints: [`${JS}/analytics.js`],
    outdir: 'app/assets/builds'
  }
};

async function main() {
  const args = process.argv.slice(2);
  const watch = args.some((arg) => arg === '--watch' || arg.startsWith('--watch='));
  const names = args.filter((arg) => !arg.startsWith('--'));

  const unknown = names.filter((name) => !BUNDLES[name]);
  if (names.length === 0 || unknown.length > 0) {
    console.error(`Usage: node esbuild.config.js <${Object.keys(BUNDLES).join('|')}>... [--watch]`);
    process.exit(1);
  }

  const contexts = await Promise.all(
    names.map((name) => esbuild.context({ ...SHARED, ...BUNDLES[name], logLevel: 'info' }))
  );

  if (watch) {
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    return; // watchers keep the process alive
  }

  // allSettled lets every bundle finish before disposing; esbuild has already logged errors.
  const results = await Promise.allSettled(contexts.map((ctx) => ctx.rebuild()));
  if (results.some((result) => result.status === 'rejected')) process.exitCode = 1;
  await Promise.all(contexts.map((ctx) => ctx.dispose()));
}

main();
