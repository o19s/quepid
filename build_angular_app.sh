#!/bin/bash

# Build script to concatenate all Angular application files
# This creates a single bundle for the Angular app code (not the vendor libraries)

OUTPUT_FILE="app/assets/builds/quepid_angular_app.js"

echo "Building Quepid Angular application bundle..."

# Start with a clean file
echo "// Quepid Angular Application Bundle" > $OUTPUT_FILE
echo "// Generated on $(date)" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Add utilities module first
echo "// Utilities Module" >> $OUTPUT_FILE
cat app/assets/javascripts/utilitiesModule.js >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Add main app module
echo "// Main App Module" >> $OUTPUT_FILE
cat app/assets/javascripts/app.js >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Add routes
echo "// Routes" >> $OUTPUT_FILE
cat app/assets/javascripts/routes.js >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Add all component files (recursively, services first, then directives, then controllers, then html templates)
echo "// Components" >> $OUTPUT_FILE

# First, add all component service files
for file in $(find app/assets/javascripts/components -name '*_service.js' | sort); do
  if [ -f "$file" ]; then
    echo "// Component Service: $(basename $file)" >> $OUTPUT_FILE
    cat "$file" >> $OUTPUT_FILE
    echo "" >> $OUTPUT_FILE
  fi
done

# Then add all component directive files
for file in $(find app/assets/javascripts/components -name '*_directive.js' | sort); do
  if [ -f "$file" ]; then
    echo "// Component Directive: $(basename $file)" >> $OUTPUT_FILE
    cat "$file" >> $OUTPUT_FILE
    echo "" >> $OUTPUT_FILE
  fi
done

# Then add all component controller files
for file in $(find app/assets/javascripts/components -name '*_controller.js' | sort); do
  if [ -f "$file" ]; then
    echo "// Component Controller: $(basename $file)" >> $OUTPUT_FILE
    cat "$file" >> $OUTPUT_FILE
    echo "" >> $OUTPUT_FILE
  fi
done

# Finally add any other component JS files
for file in $(find app/assets/javascripts/components -name '*.js' ! -name '*_service.js' ! -name '*_directive.js' ! -name '*_controller.js' | sort); do
  if [ -f "$file" ]; then
    echo "// Component: $(basename $file)" >> $OUTPUT_FILE
    cat "$file" >> $OUTPUT_FILE
    echo "" >> $OUTPUT_FILE
  fi
done

# Add all controller files
echo "// Controllers" >> $OUTPUT_FILE
for file in app/assets/javascripts/controllers/*.js; do
  if [ -f "$file" ]; then
    echo "// Controller: $(basename $file)" >> $OUTPUT_FILE
    cat "$file" >> $OUTPUT_FILE
    echo "" >> $OUTPUT_FILE
  fi
done

# Add all directive files
echo "// Directives" >> $OUTPUT_FILE
for file in app/assets/javascripts/directives/*.js; do
  if [ -f "$file" ]; then
    echo "// Directive: $(basename $file)" >> $OUTPUT_FILE
    cat "$file" >> $OUTPUT_FILE
    echo "" >> $OUTPUT_FILE
  fi
done

# Add all factory files
echo "// Factories" >> $OUTPUT_FILE
for file in app/assets/javascripts/factories/*.js; do
  if [ -f "$file" ]; then
    echo "// Factory: $(basename $file)" >> $OUTPUT_FILE
    cat "$file" >> $OUTPUT_FILE
    echo "" >> $OUTPUT_FILE
  fi
done

# Add all filter files
echo "// Filters" >> $OUTPUT_FILE
for file in app/assets/javascripts/filters/*.js; do
  if [ -f "$file" ]; then
    echo "// Filter: $(basename $file)" >> $OUTPUT_FILE
    cat "$file" >> $OUTPUT_FILE
    echo "" >> $OUTPUT_FILE
  fi
done

# Add all interceptor files
echo "// Interceptors" >> $OUTPUT_FILE
for file in app/assets/javascripts/interceptors/*.js; do
  if [ -f "$file" ]; then
    echo "// Interceptor: $(basename $file)" >> $OUTPUT_FILE
    cat "$file" >> $OUTPUT_FILE
    echo "" >> $OUTPUT_FILE
  fi
done

# Add all service files
echo "// Services" >> $OUTPUT_FILE
for file in app/assets/javascripts/services/*.js; do
  if [ -f "$file" ]; then
    echo "// Service: $(basename $file)" >> $OUTPUT_FILE
    cat "$file" >> $OUTPUT_FILE
    echo "" >> $OUTPUT_FILE
  fi
done

# Add all value files
echo "// Values" >> $OUTPUT_FILE
for file in app/assets/javascripts/values/*.js; do
  if [ -f "$file" ]; then
    echo "// Value: $(basename $file)" >> $OUTPUT_FILE
    cat "$file" >> $OUTPUT_FILE
    echo "" >> $OUTPUT_FILE
  fi
done

# Add footer
echo "// Footer" >> $OUTPUT_FILE
cat app/assets/javascripts/footer.js >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Add tour
echo "// Tour" >> $OUTPUT_FILE
cat app/assets/javascripts/tour.js >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Add ace config
echo "// ACE Config" >> $OUTPUT_FILE
cat app/assets/javascripts/ace_config.js >> $OUTPUT_FILE

echo "Angular application bundle created at $OUTPUT_FILE"
echo "File size: $(du -h $OUTPUT_FILE | cut -f1)"