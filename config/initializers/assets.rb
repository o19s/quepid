# frozen_string_literal: true

# Be sure to restart your server when you modify this file.

# Version of your assets, change this if you want to expire all your assets.
Rails.application.config.assets.version = '1.0'

# Add additional assets to the asset load path.
# Rails.application.config.assets.paths << Emoji.images_path
# Add Yarn node_modules folder to the asset load path.
Rails.application.config.assets.paths << Rails.root.join('node_modules')

Rails.application.config.assets.paths << Rails.root.join('spec/karma') if Rails.env.local?

# Precompile additional assets.
# application.js, application.css, and all non-JS/CSS in the app/assets
# folder are already added.
Rails.application.config.assets.precompile += %w[ core.css core.js admin.css admin_users.css admin.js admin_users.js
                                                  analytics.js ]
Rails.application.config.assets.precompile += %w[ application_spec.js ]

# need to precompile stuff for importmaps
# In the past we made a giant single jS file, and then precompiled it
# but now we list each individaul file.
Rails.application.config.assets.precompile += %w[ footer.js ace_config.js ]

# JS from AngularJS app
Dir.glob(Rails.root.join('app', 'assets', 'javascripts', 'services', '*.js')).each do |file|
  #relative_path = Pathname.new(file).relative_path_from(Pathname.new(Rails.root)).to_s
  #puts "File.basename(file): #{relative_path}"
  Rails.application.config.assets.precompile << "services/#{File.basename(file, '.js')}"
end
Rails.application.config.assets.precompile += %w[
  services/annotationsSvc.js
]

# JS from node modules
Rails.application.config.assets.precompile += %w[
  ace-builds/src-min-noconflict/ace.js
  ace-builds/src-min-noconflict/ext-language_tools.js
  ace-builds/src-min-noconflict/mode-json.js
  ace-builds/src-min-noconflict/mode-javascript.js
  ace-builds/src-min-noconflict/mode-lucene.js
  ace-builds/src-min-noconflict/theme-chrome.js
  ace-builds/src-min-noconflict/worker-javascript.js
]

# CSS from node modules
Rails.application.config.assets.precompile += %w[
  ng-json-explorer/dist/angular-json-explorer.css
  angular-wizard/dist/angular-wizard.css
  ng-tags-input/build/ng-tags-input.min.css
  ng-tags-input/build/ng-tags-input.bootstrap.min.css
]


# For some reason the mapping in core.css.scss isn't working, so do this.'
Rails.application.config.assets.paths << Rails.root.join('node_modules/bootstrap-icons/font')
