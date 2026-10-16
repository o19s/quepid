#!/usr/bin/env node

// Concatenates per-bundle CSS sources into app/assets/builds/ and copies
// vendor/font/image assets alongside. Pass --watch to rebuild on changes
// to any path in WATCH_PATHS (debounced via chokidar).

const fs = require('fs');
const path = require('path');

// Directories and files to watch
const WATCH_PATHS = [
  'app/assets/stylesheets',
  'node_modules/bootstrap/dist/css',
  'node_modules/bootstrap-icons/font',
];

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Every bundle source is required: a missing file must fail the build rather
// than silently ship a bundle without it (e.g. a watcher started before the
// file lists in this script changed).
function readRequiredFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing bundle source: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function copyFileIfExists(src, dest) {
  try {
    if (fs.existsSync(src)) {
      ensureDirectoryExists(path.dirname(dest));
      fs.copyFileSync(src, dest);
      return true;
    }
  } catch (error) {
    console.warn(`Warning: Could not copy ${src} to ${dest}:`, error.message);
  }
  return false;
}

const STYLES = 'app/assets/stylesheets';

// Every bundle starts with Bootstrap 5, its icons, and the shared/ sheets
// (fonts, brand variables, page skin, header brand) that both bundles load.
const BOOTSTRAP_BASE = [
  'node_modules/bootstrap/dist/css/bootstrap.css',
  'node_modules/bootstrap-icons/font/bootstrap-icons.css',
  `${STYLES}/shared/fonts.css`,
  `${STYLES}/shared/tokens.css`,
  `${STYLES}/shared/base.css`,
  `${STYLES}/shared/header.css`,
];

// Concatenates `files` in order (order matters for the cascade) into
// app/assets/builds/<name>.css.
function writeBundle(name, title, files) {
  console.log(`Building ${name}.css...`);

  const outputFile = `app/assets/builds/${name}.css`;
  let output = `/* ${title} */\n`;
  output += '\n';
  for (const file of files) {
    output += readRequiredFile(file);
    output += '\n';
  }

  fs.writeFileSync(outputFile, output);
  const stats = fs.statSync(outputFile);
  console.log(`${name}.css created (${(stats.size / 1024).toFixed(1)}KB)`);
}

// Rails pages (dashboard, books, judgements, admin, analytics): shared/ plus
// application/.
function buildApplicationCSS() {
  writeBundle('application', 'Application CSS Bundle (Bootstrap 5)', [
    ...BOOTSTRAP_BASE,
    `${STYLES}/application/header.css`,
    `${STYLES}/application/layout.css`,
    `${STYLES}/application/pages.css`,
    `${STYLES}/application/teams.css`,
    `${STYLES}/application/sign_in.css`,
    `${STYLES}/application/judging.css`,
    `${STYLES}/application/books.css`,
  ]);
}

// The core case workspace: shared/ plus core/.
function buildCoreCSS() {
  writeBundle('core', 'Core CSS Bundle (Bootstrap 5 for the core case UI)', [
    ...BOOTSTRAP_BASE,
    `${STYLES}/core/layout.css`,
    `${STYLES}/core/header.css`,
    `${STYLES}/core/bootstrap_overrides.css`,
    `${STYLES}/core/query_list.css`,
    `${STYLES}/core/search_results.css`,
    `${STYLES}/core/scores.css`,
    `${STYLES}/core/diff.css`,
    `${STYLES}/core/match_explain.css`,
    `${STYLES}/core/dev_settings.css`,
    `${STYLES}/core/annotations.css`,
    `${STYLES}/core/flash.css`,
    `${STYLES}/core/modals.css`,
    'node_modules/shepherd.js/dist/css/shepherd.css',
    `${STYLES}/core/tour.css`,
    `${STYLES}/core/animations.css`,
    `${STYLES}/core/json_explorer.css`,
  ]);
}

function copyFontFiles() {
  console.log('Copying font files...');
  
  ensureDirectoryExists('app/assets/builds/fonts');
  
  copyFileIfExists('node_modules/bootstrap-icons/font/fonts/bootstrap-icons.woff', 'app/assets/builds/fonts/bootstrap-icons.woff');
  copyFileIfExists('node_modules/bootstrap-icons/font/fonts/bootstrap-icons.woff2', 'app/assets/builds/fonts/bootstrap-icons.woff2');
}

function copyImageFiles() {
  console.log('Copying image files...');
  
  ensureDirectoryExists('app/assets/builds/images');
  
  copyFileIfExists('public/images/querqy-icon.png', 'app/assets/builds/images/querqy-icon.png');
}

function buildAllCSS() {
  console.log('Building CSS bundles...');
  
  try {
    // Create builds directory if it doesn't exist
    ensureDirectoryExists('app/assets/builds');
    
    // Build all CSS bundles
    buildApplicationCSS();
    buildCoreCSS();

    // Copy font and image assets
    copyFontFiles();
    copyImageFiles();
    
    console.log('CSS bundles created successfully!');
    return true;
  } catch (error) {
    console.error('Error building CSS:', error.message);
    return false;
  }
}

// Main execution
function main() {
  const isWatchMode = process.argv.includes('--watch');
  
  // Initial build; a one-off build fails the command (watch mode keeps
  // watching so the next save can fix it).
  if (!buildAllCSS() && !isWatchMode) {
    process.exit(1);
  }
  
  if (isWatchMode) {
    console.log('Watching for CSS changes...');
    
    try {
      const chokidar = require('chokidar');
      
      let debounceTimer;
      const DEBOUNCE_DELAY = 300; // Wait 300ms before rebuilding
      
      const watcher = chokidar.watch(WATCH_PATHS, {
        ignored: [/(^|[\/\\])\./, 'node_modules/.bin', 'app/assets/builds'],
        persistent: true,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 100
        }
      });

      const debouncedRebuild = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          console.log('Rebuilding CSS...');
          buildAllCSS();
        }, DEBOUNCE_DELAY);
      };

      watcher.on('change', (path) => {
        console.log(`CSS file changed: ${path}`);
        debouncedRebuild();
      });

      watcher.on('add', () => {
        debouncedRebuild();
      });

      watcher.on('unlink', (path) => {
        console.log(`CSS file removed: ${path}`);
        debouncedRebuild();
      });

      watcher.on('error', error => {
        console.error('CSS watcher error:', error);
      });
      
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        console.error('chokidar not found. Please run: npm install');
        process.exit(1);
      }
      throw error;
    }
  }
}

// Run the script
main();
