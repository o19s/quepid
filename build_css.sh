#!/bin/bash

# Build script to concatenate CSS files for the application
# Creates CSS bundles that match the previous Sprockets manifests

echo "Building CSS bundles..."

# Create builds directory if it doesn't exist
mkdir -p app/assets/builds

# Build application.css (Bootstrap 5 version for modern app)
echo "Building application.css..."
OUTPUT_FILE="app/assets/builds/application.css"
echo "/* Application CSS Bundle (Bootstrap 5) */" > $OUTPUT_FILE
echo "/* Generated on $(date) */" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Bootstrap 5
cat node_modules/bootstrap/dist/css/bootstrap.css >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Bootstrap Icons
cat node_modules/bootstrap-icons/font/bootstrap-icons.css >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Application styles
cat app/assets/stylesheets/fonts.css >> $OUTPUT_FILE 2>/dev/null || true
echo "" >> $OUTPUT_FILE
cat app/assets/stylesheets/bootstrap5-add.css >> $OUTPUT_FILE 2>/dev/null || true
echo "" >> $OUTPUT_FILE
cat app/assets/stylesheets/signup.css >> $OUTPUT_FILE 2>/dev/null || true
echo "" >> $OUTPUT_FILE
cat app/assets/stylesheets/judgements.css >> $OUTPUT_FILE 2>/dev/null || true
echo "" >> $OUTPUT_FILE

# Add the inline styles from application.css
cat app/assets/stylesheets/application.css | sed '/^\/\*/,/\*\//d' | sed '/^$/d' >> $OUTPUT_FILE

echo "application.css created ($(du -h $OUTPUT_FILE | cut -f1))"

# Build core.css (Bootstrap 3 version for Angular app)
echo "Building core.css..."
OUTPUT_FILE="app/assets/builds/core.css"
echo "/* Core CSS Bundle (Bootstrap 3 for Angular App) */" > $OUTPUT_FILE
echo "/* Generated on $(date) */" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Bootstrap 3
cat app/assets/stylesheets/bootstrap3.css >> $OUTPUT_FILE 2>/dev/null || true
echo "" >> $OUTPUT_FILE

# Bootstrap Icons (shared between both)
cat node_modules/bootstrap-icons/font/bootstrap-icons.css >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Core application styles
cat app/assets/stylesheets/fonts.css >> $OUTPUT_FILE 2>/dev/null || true
echo "" >> $OUTPUT_FILE
cat app/assets/stylesheets/bootstrap3-add.css >> $OUTPUT_FILE 2>/dev/null || true
echo "" >> $OUTPUT_FILE
cat app/assets/stylesheets/style.css >> $OUTPUT_FILE 2>/dev/null || true
echo "" >> $OUTPUT_FILE
cat app/assets/stylesheets/base.css >> $OUTPUT_FILE 2>/dev/null || true
echo "" >> $OUTPUT_FILE
cat app/assets/stylesheets/panes.css >> $OUTPUT_FILE 2>/dev/null || true
echo "" >> $OUTPUT_FILE
cat app/assets/stylesheets/stackedChart.css >> $OUTPUT_FILE 2>/dev/null || true
echo "" >> $OUTPUT_FILE

# Tour/Guides
cat node_modules/tether-shepherd/dist/css/shepherd-theme-arrows.css >> $OUTPUT_FILE 2>/dev/null || true
echo "" >> $OUTPUT_FILE
cat app/assets/stylesheets/tour.css >> $OUTPUT_FILE 2>/dev/null || true
echo "" >> $OUTPUT_FILE

# Screens
for screen in cases scorers books search_endpoints teams users docs settings qscore qgraph; do
  if [ -f "app/assets/stylesheets/${screen}.css" ]; then
    cat "app/assets/stylesheets/${screen}.css" >> $OUTPUT_FILE
    echo "" >> $OUTPUT_FILE
  fi
done

# Other styles
cat app/assets/stylesheets/misc.css >> $OUTPUT_FILE 2>/dev/null || true
echo "" >> $OUTPUT_FILE
cat app/assets/stylesheets/animation.css >> $OUTPUT_FILE 2>/dev/null || true
echo "" >> $OUTPUT_FILE
cat app/assets/stylesheets/froggy.css >> $OUTPUT_FILE 2>/dev/null || true
echo "" >> $OUTPUT_FILE

echo "core.css created ($(du -h $OUTPUT_FILE | cut -f1))"

# Build admin.css
echo "Building admin.css..."
OUTPUT_FILE="app/assets/builds/admin.css"
echo "/* Admin CSS Bundle (Bootstrap 5) */" > $OUTPUT_FILE
echo "/* Generated on $(date) */" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Bootstrap 5
cat node_modules/bootstrap/dist/css/bootstrap.css >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Bootstrap Icons
cat node_modules/bootstrap-icons/font/bootstrap-icons.css >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Cal-heatmap
cat node_modules/cal-heatmap/dist/cal-heatmap.css >> $OUTPUT_FILE 2>/dev/null || true
echo "" >> $OUTPUT_FILE

# Fonts
cat app/assets/stylesheets/fonts.css >> $OUTPUT_FILE 2>/dev/null || true
echo "" >> $OUTPUT_FILE

# Bootstrap 5 additions
cat app/assets/stylesheets/bootstrap5-add.css >> $OUTPUT_FILE 2>/dev/null || true
echo "" >> $OUTPUT_FILE

# Admin-specific styles
cat app/assets/stylesheets/admin2.css >> $OUTPUT_FILE 2>/dev/null || true
echo "" >> $OUTPUT_FILE

echo "admin.css created ($(du -h $OUTPUT_FILE | cut -f1))"

# Build admin_users.css
echo "Building admin_users.css..."
OUTPUT_FILE="app/assets/builds/admin_users.css"
echo "/* Admin Users CSS Bundle */" > $OUTPUT_FILE
echo "/* Generated on $(date) */" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Copy admin_users.css if it exists
if [ -f "app/assets/stylesheets/admin_users.css" ]; then
  cat app/assets/stylesheets/admin_users.css >> $OUTPUT_FILE
fi

echo "admin_users.css created ($(du -h $OUTPUT_FILE | cut -f1))"

# Copy Angular third-party CSS files
echo "Copying Angular vendor CSS files..."
cp node_modules/ng-json-explorer/dist/angular-json-explorer.css app/assets/builds/ 2>/dev/null || true
cp node_modules/angular-wizard/dist/angular-wizard.css app/assets/builds/ 2>/dev/null || true
cp node_modules/ng-tags-input/build/ng-tags-input.min.css app/assets/builds/ 2>/dev/null || true
cp node_modules/ng-tags-input/build/ng-tags-input.bootstrap.min.css app/assets/builds/ 2>/dev/null || true

# Copy font files
echo "Copying font files..."
mkdir -p app/assets/builds/fonts
cp node_modules/bootstrap-icons/font/fonts/bootstrap-icons.woff app/assets/builds/fonts/ 2>/dev/null || true
cp node_modules/bootstrap-icons/font/fonts/bootstrap-icons.woff2 app/assets/builds/fonts/ 2>/dev/null || true

# Copy image files
echo "Copying image files..."
mkdir -p app/assets/builds/images
cp public/images/querqy-icon.png app/assets/builds/images/ 2>/dev/null || true
cp public/images/loading.gif app/assets/builds/images/ 2>/dev/null || true

echo "CSS bundles created successfully!"

# Watch mode - rebuild if any CSS files change
if [ "$1" == "--watch" ]; then
  echo "Watching for CSS changes..."
  while true; do
    # Use fswatch if available, otherwise fall back to basic sleep loop
    if command -v fswatch &> /dev/null; then
      fswatch -1 app/assets/stylesheets/ node_modules/bootstrap/dist/css/ node_modules/bootstrap-icons/font/ > /dev/null
      echo "CSS files changed, rebuilding..."
      $0  # Re-run this script without --watch
    else
      sleep 5
    fi
  done
fi