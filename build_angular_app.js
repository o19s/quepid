#!/usr/bin/env node

// Node.js script to build Angular application bundle with proper file watching
// Replaces build_angular_app.sh with better file watching using chokidar

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUTPUT_FILE = 'app/assets/builds/quepid_angular_app.js';

// Directories and files to watch
const WATCH_PATHS = [
  'app/assets/javascripts/utilitiesModule.js',
  'app/assets/javascripts/app.js',
  'app/assets/javascripts/routes.js',
  'app/assets/javascripts/components',
  'app/assets/javascripts/controllers',
  'app/assets/javascripts/directives',
  'app/assets/javascripts/factories',
  'app/assets/javascripts/filters',
  'app/assets/javascripts/interceptors',
  'app/assets/javascripts/services',
  'app/assets/javascripts/values',
  'app/assets/javascripts/footer.js',
  'app/assets/javascripts/tour.js',
  'app/assets/javascripts/ace_config.js'
];

function buildAngularApp() {
  console.log('Building Quepid Angular application bundle...');

  try {
    // Start with a clean file
    let output = '// Quepid Angular Application Bundle\n';
    output += `// Generated on ${new Date().toISOString()}\n`;
    output += '\n';

    // Add utilities module first
    if (fs.existsSync('app/assets/javascripts/utilitiesModule.js')) {
      output += '// Utilities Module\n';
      output += fs.readFileSync('app/assets/javascripts/utilitiesModule.js', 'utf8');
      output += '\n\n';
    }

    // Add main app module
    if (fs.existsSync('app/assets/javascripts/app.js')) {
      output += '// Main App Module\n';
      output += fs.readFileSync('app/assets/javascripts/app.js', 'utf8');
      output += '\n\n';
    }

    // Add routes
    if (fs.existsSync('app/assets/javascripts/routes.js')) {
      output += '// Routes\n';
      output += fs.readFileSync('app/assets/javascripts/routes.js', 'utf8');
      output += '\n\n';
    }

    // Add all component files (recursively, services first, then directives, then controllers)
    output += '// Components\n';
    
    // Helper function to get files recursively
    function getFilesRecursively(dir, pattern) {
      if (!fs.existsSync(dir)) return [];
      
      const files = [];
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          files.push(...getFilesRecursively(fullPath, pattern));
        } else if (item.match(pattern)) {
          files.push(fullPath);
        }
      }
      
      return files.sort();
    }

    // First, add all component service files
    const serviceFiles = getFilesRecursively('app/assets/javascripts/components', /_service\.js$/);
    for (const file of serviceFiles) {
      output += `// Component Service: ${path.basename(file)}\n`;
      output += fs.readFileSync(file, 'utf8');
      output += '\n\n';
    }

    // Then add all component directive files
    const directiveFiles = getFilesRecursively('app/assets/javascripts/components', /_directive\.js$/);
    for (const file of directiveFiles) {
      output += `// Component Directive: ${path.basename(file)}\n`;
      output += fs.readFileSync(file, 'utf8');
      output += '\n\n';
    }

    // Then add all component controller files
    const controllerFiles = getFilesRecursively('app/assets/javascripts/components', /_controller\.js$/);
    for (const file of controllerFiles) {
      output += `// Component Controller: ${path.basename(file)}\n`;
      output += fs.readFileSync(file, 'utf8');
      output += '\n\n';
    }

    // Finally add any other component JS files
    const otherComponentFiles = getFilesRecursively('app/assets/javascripts/components', /\.js$/)
      .filter(file => !file.match(/_service\.js$|_directive\.js$|_controller\.js$/));
    for (const file of otherComponentFiles) {
      output += `// Component: ${path.basename(file)}\n`;
      output += fs.readFileSync(file, 'utf8');
      output += '\n\n';
    }

    // Helper function to add files from directory
    function addFilesFromDir(dirName, sectionName) {
      const dir = `app/assets/javascripts/${dirName}`;
      if (fs.existsSync(dir)) {
        output += `// ${sectionName}\n`;
        const files = fs.readdirSync(dir)
          .filter(file => file.endsWith('.js'))
          .sort();
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          if (fs.statSync(filePath).isFile()) {
            output += `// ${sectionName.slice(0, -1)}: ${file}\n`;
            output += fs.readFileSync(filePath, 'utf8');
            output += '\n\n';
          }
        }
      }
    }

    // Add all other types of files
    addFilesFromDir('controllers', 'Controllers');
    addFilesFromDir('directives', 'Directives');
    addFilesFromDir('factories', 'Factories');
    addFilesFromDir('filters', 'Filters');
    addFilesFromDir('interceptors', 'Interceptors');
    addFilesFromDir('services', 'Services');
    addFilesFromDir('values', 'Values');

    // Add footer
    if (fs.existsSync('app/assets/javascripts/footer.js')) {
      output += '// Footer\n';
      output += fs.readFileSync('app/assets/javascripts/footer.js', 'utf8');
      output += '\n\n';
    }

    // Add tour
    if (fs.existsSync('app/assets/javascripts/tour.js')) {
      output += '// Tour\n';
      output += fs.readFileSync('app/assets/javascripts/tour.js', 'utf8');
      output += '\n\n';
    }

    // Add ace config
    if (fs.existsSync('app/assets/javascripts/ace_config.js')) {
      output += '// ACE Config\n';
      output += fs.readFileSync('app/assets/javascripts/ace_config.js', 'utf8');
    }

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write the bundle
    fs.writeFileSync(OUTPUT_FILE, output);
    
    const stats = fs.statSync(OUTPUT_FILE);
    console.log(`Angular application bundle created at ${OUTPUT_FILE}`);
    console.log(`File size: ${(stats.size / 1024).toFixed(1)}KB`);
    
    return true;
  } catch (error) {
    console.error('Error building Angular app:', error.message);
    return false;
  }
}

// Main execution
function main() {
  const isWatchMode = process.argv.includes('--watch');
  
  // Initial build
  buildAngularApp();
  
  if (isWatchMode) {
    console.log('Watching for Angular app changes...');
    
    try {
      const chokidar = require('chokidar');
      
      let debounceTimer;
      const DEBOUNCE_DELAY = 300; // Wait 300ms before rebuilding
      
      const watcher = chokidar.watch(WATCH_PATHS, {
        ignored: [/(^|[\/\\])\./, 'node_modules', 'app/assets/builds'],
        persistent: true,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 100
        }
      });

      const debouncedRebuild = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          console.log('Rebuilding Angular app...');
          buildAngularApp();
        }, DEBOUNCE_DELAY);
      };

      watcher.on('change', (path) => {
        console.log(`Angular file changed: ${path}`);
        debouncedRebuild();
      });

      watcher.on('add', (path) => {
        debouncedRebuild();
      });

      watcher.on('unlink', (path) => {
        console.log(`Angular file removed: ${path}`);
        debouncedRebuild();
      });

      watcher.on('error', error => {
        console.error('Watcher error:', error);
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
