# frozen_string_literal: true

source 'https://rubygems.org'

ruby '3.3.0'

gem 'activerecord-import', '>= 1.0.7'
gem 'active_storage_db'
gem 'acts_as_list', '>= 1.0.1'
gem 'ancestry'
gem 'angular-rails-templates', '>= 1.0.0.beta'
gem 'apipie-rails', '~> 1.2'
gem 'bcrypt', '~> 3.1.7'
gem 'bootsnap', require: false
gem 'cal-heatmap-rails', '~> 3.6' # provides assets for cal heatmap, that requires old d3
gem 'colorize', require: false
gem 'cookies_eu'
gem 'd3-rails', '~> 3.5.5' # For cal heatmap
gem 'devise', '>= 4.6.2'
gem 'devise_invitable', '~> 2.0'

# Using this as it wires in via Sprockets and I can't get npm version to work with the main app.
# Had no luck with js/svg approach ;-(
gem 'font-awesome-sass'
gem 'gabba'
gem 'importmap-rails', '~> 2.0'
gem 'intercom-rails'
gem 'jbuilder', '~> 2.7'
gem 'jquery-rails'
gem 'jquery-ui-rails' # Can we narrow the widgets to load faster?
gem 'listen', '~> 3.3'
gem 'local_time'
gem 'mysql2'
gem 'omniauth'
gem 'omniauth-keycloak'
gem 'omniauth-google-oauth2'
gem 'omniauth-rails_csrf_protection'
gem 'postmark-rails'
gem 'prophet-rb', '~> 0.5.0'
gem 'puma'
gem 'pundit'
gem 'rails', '~> 7.1.2'
gem 'rails-healthcheck', '~> 1.4'
gem 'rails-html-sanitizer'
gem 'rack-cors', '~> 2.0'
gem 'rapidjson'
gem 'redis', '~> 5.1.0'
gem 'responders'
gem 'rubyzip'
gem 'sassc-rails', '~> 2.1'
gem 'sidekiq'
gem 'terser'
gem 'thor'
gem 'turbo-rails', '~> 2.0', '>= 2.0.5'
gem 'vega', '~> 0.3.0'

group :development, :test do
  gem 'annotate'
  gem 'bullet'
  gem 'memory_profiler'
end

group :development do
  # Use console on exceptions pages [https://github.com/rails/web-console]
  gem 'web-console'

  # See https://guides.rubyonrails.org/debugging_rails_applications.html#debugging-with-the-debug-gem
  # Add me back in when Ruby 3.2.X comes out https://github.com/ruby/debug/issues/898
  # gem 'debug', platforms: [ :mri, :mingw, :x64_mingw ]

  # Add speed badges [https://github.com/MiniProfiler/rack-mini-profiler]
  gem 'rack-mini-profiler'

  gem 'derailed_benchmarks'
  gem 'letter_opener'
  gem 'rubocop', require: false
  gem 'rubocop-rails', require: false
  gem 'rubocop-capybara', require: false
  gem 'rails-erd', '~> 1.6'
end

group :test do
  gem 'minitest-reporters', '>= 0.5.0'
  gem 'mocha', '~> 2.0'
  gem 'simplecov', require: false
  gem 'webmock'
  gem 'rails-controller-testing' # bring back compatibility with rails 4 assigns in controller tests.

  # Use system testing [https://guides.rubyonrails.org/testing.html#system-testing]
  gem 'capybara'
  gem 'selenium-webdriver'
end

gem 'sidekiq-limit_fetch', '~> 4.4'
