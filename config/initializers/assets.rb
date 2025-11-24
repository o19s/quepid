# frozen_string_literal: true

# Be sure to restart your server when you modify this file.

# Propshaft asset pipeline configuration
# Assets are now built using npm scripts (see package.json) and served from app/assets/builds/

# Version of your assets, change this if you want to expire all your assets.
Rails.application.config.assets.version = '1.0'

# Add node_modules to asset paths for Propshaft to serve
Rails.application.config.assets.paths << Rails.root.join('node_modules')

# Add Karma test files in development/test
Rails.application.config.assets.paths << Rails.root.join('spec/karma') if Rails.env.local?

# Add Bootstrap Icons font directory
Rails.application.config.assets.paths << Rails.root.join('node_modules/bootstrap-icons/font')
