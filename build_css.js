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

function readFileIfExists(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch (error) {
    console.warn(`Warning: Could not read ${filePath}:`, error.message);
  }
  return '';
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

// Every bundle starts with Bootstrap 5, its icons, and Quepid's fonts.
const BOOTSTRAP_BASE = [
  'node_modules/bootstrap/dist/css/bootstrap.css',
  'node_modules/bootstrap-icons/font/bootstrap-icons.css',
  `${STYLES}/fonts.css`,
];

// Concatenates `files` in order (order matters for the cascade) into
// app/assets/builds/<name>.css, followed by `trailer` if given.
function writeBundle(name, title, files, trailer = '') {
  console.log(`Building ${name}.css...`);

  const outputFile = `app/assets/builds/${name}.css`;
  let output = `/* ${title} */\n`;
  output += `/* Generated on ${new Date().toISOString()} */\n`;
  output += '\n';
  for (const file of files) {
    output += readFileIfExists(file);
    output += '\n';
  }
  output += trailer;

  fs.writeFileSync(outputFile, output);
  const stats = fs.statSync(outputFile);
  console.log(`${name}.css created (${(stats.size / 1024).toFixed(1)}KB)`);
}

function buildApplicationCSS() {
  // The inline rules from application.css, with comments and blank lines stripped.
  const appCSS = readFileIfExists(`${STYLES}/application.css`)
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
    .replace(/^\s*$/gm, '') // Remove empty lines
    .trim();

  writeBundle('application', 'Application CSS Bundle (Bootstrap 5)', [
    ...BOOTSTRAP_BASE,
    `${STYLES}/navbar-brand.css`,
    `${STYLES}/bootstrap5-add.css`,
    `${STYLES}/signup.css`,
    `${STYLES}/judgements.css`,
  ], appCSS);
}

function buildCoreCSS() {
  writeBundle('core', 'Core CSS Bundle (Bootstrap 5 for the core case UI)', [
    ...BOOTSTRAP_BASE,
    // Quepid layout, then the BS5 overrides (px sizing, popovers, header nav,
    // modals, sub-results toolbar, ...).
    `${STYLES}/core-additions.css`,
    `${STYLES}/navbar-brand.css`,
    `${STYLES}/bootstrap5-compat.css`,
    `${STYLES}/style.css`,
    `${STYLES}/panes.css`,
    `${STYLES}/stackedChart.css`,
    // Tour/Guides
    'node_modules/tether-shepherd/dist/css/shepherd-theme-arrows.css',
    `${STYLES}/tour.css`,
    // Screen-specific styles
    `${STYLES}/docs.css`,
    `${STYLES}/qscore.css`,
    `${STYLES}/qgraph.css`,
    // Other styles
    `${STYLES}/misc.css`,
    `${STYLES}/animation.css`,
    `${STYLES}/froggy.css`,
  ]);
}

function buildAdminCSS() {
  writeBundle('admin', 'Admin CSS Bundle (Bootstrap 5)', [
    ...BOOTSTRAP_BASE,
    `${STYLES}/navbar-brand.css`,
    `${STYLES}/bootstrap5-add.css`,
    `${STYLES}/admin2.css`,
  ]);
}

// Standalone stylesheets linked from layouts/_case_head.html.erb (not folded into core.css).
function copyLinkedStylesheets() {
  console.log('Copying linked stylesheets...');

  ensureDirectoryExists('app/assets/builds');

  copyFileIfExists(
    'app/assets/stylesheets/json-explorer.css',
    'app/assets/builds/json-explorer.css'
  );
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
    buildAdminCSS();

    // Copy linked stylesheets and other asset files
    copyLinkedStylesheets();
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
  
  // Initial build
  buildAllCSS();
  
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

      watcher.on('add', (path) => {
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
