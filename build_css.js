#!/usr/bin/env node

// Node.js script to build CSS bundles with proper file watching
// Replaces build_css.sh with better file watching using chokidar

const fs = require('fs');
const path = require('path');

// Directories and files to watch
const WATCH_PATHS = [
  'app/assets/stylesheets',
  'node_modules/bootstrap/dist/css',
  'node_modules/bootstrap-icons/font'
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

function buildApplicationCSS() {
  console.log('Building application.css...');
  
  const outputFile = 'app/assets/builds/application.css';
  let output = '/* Application CSS Bundle (Bootstrap 5) */\n';
  output += `/* Generated on ${new Date().toISOString()} */\n`;
  output += '\n';

  // Bootstrap 5
  output += readFileIfExists('node_modules/bootstrap/dist/css/bootstrap.css');
  output += '\n';

  // Bootstrap Icons
  output += readFileIfExists('node_modules/bootstrap-icons/font/bootstrap-icons.css');
  output += '\n';

  // Application styles
  output += readFileIfExists('app/assets/stylesheets/fonts.css');
  output += '\n';
  output += readFileIfExists('app/assets/stylesheets/bootstrap5-add.css');
  output += '\n';
  output += readFileIfExists('app/assets/stylesheets/signup.css');
  output += '\n';
  output += readFileIfExists('app/assets/stylesheets/judgements.css');
  output += '\n';

  // Add the inline styles from application.css (excluding comments)
  const appCSS = readFileIfExists('app/assets/stylesheets/application.css');
  if (appCSS) {
    const cleanedAppCSS = appCSS
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/^\s*$/gm, '') // Remove empty lines
      .trim();
    if (cleanedAppCSS) {
      output += cleanedAppCSS;
    }
  }

  fs.writeFileSync(outputFile, output);
  const stats = fs.statSync(outputFile);
  console.log(`application.css created (${(stats.size / 1024).toFixed(1)}KB)`);
}

function buildCoreCSS() {
  console.log('Building core.css...');
  
  const outputFile = 'app/assets/builds/core.css';
  let output = '/* Core CSS Bundle (Bootstrap 3 for Angular App) */\n';
  output += `/* Generated on ${new Date().toISOString()} */\n`;
  output += '\n';

  // Bootstrap 3
  output += readFileIfExists('app/assets/stylesheets/bootstrap3.css');
  output += '\n';

  // Bootstrap Icons (shared between both)
  output += readFileIfExists('node_modules/bootstrap-icons/font/bootstrap-icons.css');
  output += '\n';

  // Core application styles
  output += readFileIfExists('app/assets/stylesheets/fonts.css');
  output += '\n';
  output += readFileIfExists('app/assets/stylesheets/bootstrap3-add.css');
  output += '\n';
  output += readFileIfExists('app/assets/stylesheets/style.css');
  output += '\n';
  output += readFileIfExists('app/assets/stylesheets/base.css');
  output += '\n';
  output += readFileIfExists('app/assets/stylesheets/panes.css');
  output += '\n';
  output += readFileIfExists('app/assets/stylesheets/stackedChart.css');
  output += '\n';

  // Tour/Guides
  output += readFileIfExists('node_modules/tether-shepherd/dist/css/shepherd-theme-arrows.css');
  output += '\n';
  output += readFileIfExists('app/assets/stylesheets/tour.css');
  output += '\n';

  // Screen-specific styles
  const screens = ['cases', 'docs', 'settings', 'qscore', 'qgraph'];
  for (const screen of screens) {
    output += readFileIfExists(`app/assets/stylesheets/${screen}.css`);
    output += '\n';
  }

  // Other styles
  output += readFileIfExists('app/assets/stylesheets/misc.css');
  output += '\n';
  output += readFileIfExists('app/assets/stylesheets/animation.css');
  output += '\n';
  output += readFileIfExists('app/assets/stylesheets/froggy.css');
  output += '\n';

  fs.writeFileSync(outputFile, output);
  const stats = fs.statSync(outputFile);
  console.log(`core.css created (${(stats.size / 1024).toFixed(1)}KB)`);
}

function buildAdminCSS() {
  console.log('Building admin.css...');
  
  const outputFile = 'app/assets/builds/admin.css';
  let output = '/* Admin CSS Bundle (Bootstrap 5) */\n';
  output += `/* Generated on ${new Date().toISOString()} */\n`;
  output += '\n';

  // Bootstrap 5
  output += readFileIfExists('node_modules/bootstrap/dist/css/bootstrap.css');
  output += '\n';

  // Bootstrap Icons
  output += readFileIfExists('node_modules/bootstrap-icons/font/bootstrap-icons.css');
  output += '\n';

  // Cal-heatmap
  output += readFileIfExists('node_modules/cal-heatmap/dist/cal-heatmap.css');
  output += '\n';

  // Fonts
  output += readFileIfExists('app/assets/stylesheets/fonts.css');
  output += '\n';

  // Bootstrap 5 additions
  output += readFileIfExists('app/assets/stylesheets/bootstrap5-add.css');
  output += '\n';

  // Admin-specific styles
  output += readFileIfExists('app/assets/stylesheets/admin2.css');
  output += '\n';

  fs.writeFileSync(outputFile, output);
  const stats = fs.statSync(outputFile);
  console.log(`admin.css created (${(stats.size / 1024).toFixed(1)}KB)`);
}

function buildAdminUsersCSS() {
  console.log('Building admin_users.css...');
  
  const outputFile = 'app/assets/builds/admin_users.css';
  let output = '/* Admin Users CSS Bundle */\n';
  output += `/* Generated on ${new Date().toISOString()} */\n`;
  output += '\n';

  // Copy admin_users.css if it exists
  output += readFileIfExists('app/assets/stylesheets/admin_users.css');

  fs.writeFileSync(outputFile, output);
  const stats = fs.statSync(outputFile);
  console.log(`admin_users.css created (${(stats.size / 1024).toFixed(1)}KB)`);
}

function copyVendorFiles() {
  console.log('Copying Angular vendor CSS files...');
  
  ensureDirectoryExists('app/assets/builds');
  
  // Copy Angular third-party CSS files
  copyFileIfExists('node_modules/ng-json-explorer/dist/angular-json-explorer.css', 'app/assets/builds/angular-json-explorer.css');
  copyFileIfExists('node_modules/angular-wizard/dist/angular-wizard.css', 'app/assets/builds/angular-wizard.css');
  copyFileIfExists('node_modules/ng-tags-input/build/ng-tags-input.min.css', 'app/assets/builds/ng-tags-input.min.css');
  copyFileIfExists('node_modules/ng-tags-input/build/ng-tags-input.bootstrap.min.css', 'app/assets/builds/ng-tags-input.bootstrap.min.css');
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
    buildAdminUsersCSS();
    
    // Copy vendor and asset files
    copyVendorFiles();
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
