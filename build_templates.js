// Script to compile Angular templates into a JavaScript module
// This replaces the angular-rails-templates gem functionality

const fs = require('fs');
const path = require('path');

const TEMPLATE_DIRS = [
  'app/assets/javascripts/components',
  'app/assets/templates'
];
const OUTPUT_FILE = 'app/assets/builds/angular_templates.js';

function escapeHtml(html) {
  return html
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

function processDirectory(dir, baseDir = '', templates = {}) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      processDirectory(fullPath, path.join(baseDir, file), templates);
    } else if (file.endsWith('.html') || file.endsWith('.html.erb')) {
      let content = fs.readFileSync(fullPath, 'utf8');

      // Remove .erb extension if present for the template name
      let templateName = path.join(baseDir, file).replace(/\.erb$/, '');

      // Store template content
      templates[templateName] = content;
    }
  });

  return templates;
}

function generateTemplateModule() {
  let templates = {};
  
  // Process all template directories
  TEMPLATE_DIRS.forEach(dir => {
    processDirectory(dir, '', templates);
  });

  let output = `// Angular Templates Bundle
// Generated on ${new Date().toISOString()}

(function() {
  'use strict';

  angular.module('templates', [])
    .run(['$templateCache', function($templateCache) {
`;

  Object.keys(templates).forEach(templateName => {
    const content = escapeHtml(templates[templateName]);
    output += `      $templateCache.put('${templateName}', '${content}');\n`;
  });

  output += `    }]);
})();
`;

  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`Generated ${Object.keys(templates).length} templates in ${OUTPUT_FILE}`);
  console.log(`File size: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1)}KB`);
}

// Run the template generation
generateTemplateModule();

// Watch mode - rebuild if any template files change
if (process.argv.includes('--watch')) {
  console.log('Watching for template changes...');
  const chokidar = require('chokidar');
  
  const watcher = chokidar.watch(TEMPLATE_DIRS, {
    ignored: /(^|[\/\\])\../,
    persistent: true
  });

  watcher.on('change', (path) => {
    console.log(`Template changed: ${path}, rebuilding...`);
    generateTemplateModule();
  });

  watcher.on('add', (path) => {
    console.log(`Template added: ${path}, rebuilding...`);
    generateTemplateModule();
  });

  watcher.on('unlink', (path) => {
    console.log(`Template removed: ${path}, rebuilding...`);
    generateTemplateModule();
  });
}