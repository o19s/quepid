# frozen_string_literal: true

# Be sure to restart your server when you modify this file.

# Propshaft asset pipeline configuration
# Assets are now built using npm scripts (see package.json) and served from app/assets/builds/

# Version of your assets, change this if you want to expire all your assets.
Rails.application.config.assets.version = '1.0'

# We no longer add the entire node_modules tree; build scripts copy needed assets
Rails.application.config.assets.paths << Rails.root.join('app/assets/builds')

# Add Karma test files in development/test
Rails.application.config.assets.paths << Rails.root.join('spec/karma') if Rails.env.local?

# Add Bootstrap Icons font directory
Rails.application.config.assets.paths << Rails.root.join('node_modules/bootstrap-icons/font')

# NOTE: Avoid scanning packages with broken symlinks (e.g. angular-flash) by not
# adding node_modules wholesale. Specific subpaths like fonts are added above.
