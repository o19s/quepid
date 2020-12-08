# frozen_string_literal: true

# Be sure to restart your server when you modify this file.

# Version of your assets, change this if you want to expire all your assets.
Rails.application.config.assets.version = '1.0'

# Add additional assets to the asset load path.
# Rails.application.config.assets.paths << Emoji.images_path
# Add Yarn node_modules folder to the asset load path.
Rails.application.config.assets.paths << Rails.root.join('node_modules')

Rails.application.config.assets.paths << Rails.root.join('spec/karma') if Rails.env.development? || Rails.env.test?

# Precompile additional assets.
# application.js, application.css, and all non-JS/CSS in the app/assets
# folder are already added.
Rails.application.config.assets.precompile += %w[ secure.js secure.css admin.js ]
Rails.application.config.assets.precompile += %w[ application_spec.js ]

# CSS from node modules
Rails.application.config.assets.precompile += %w[
  ng-json-explorer/dist/angular-json-explorer.css
  angular-wizard/dist/angular-wizard.css
  ng-tags-input/build/ng-tags-input.min.css
  ng-tags-input/build/ng-tags-input.bootstrap.min.css
]
