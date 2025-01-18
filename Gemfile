# frozen_string_literal: true

source 'https://rubygems.org'

ruby '3.3.6'

gem 'activerecord-import', '>= 1.0.7'
gem 'active_storage_db'
gem 'acts_as_list', '>= 1.0.1'
gem 'addressable', '~> 2.8'
gem 'ahoy_matey'
gem 'ancestry'
gem 'angular-rails-templates', '~> 1.3'
gem 'apipie-rails', '~> 1.2'
gem 'bcrypt', '~> 3.1.7'
gem 'blazer', '~> 3.1'
gem 'bootsnap', require: false
gem 'cal-heatmap-rails', '~> 3.6' # provides assets for cal heatmap, that requires old d3
gem 'colorize', require: false
gem 'd3-rails', '~> 3.5.5' # For cal heatmap
gem 'devise', '>= 4.6.2'
gem 'devise_invitable', '~> 2.0'

# Using this as it wires in via Sprockets and I can't get npm version to work with the main app.
# Had no luck with js/svg approach ;-(
gem 'foreman'
gem 'importmap-rails', '~> 2.1'
gem 'intercom-rails'
gem 'jbuilder', '~> 2.7'
gem 'jquery-rails'
gem 'jquery-ui-rails' # Can we narrow the widgets to load faster?
gem 'listen', '~> 3.3'
gem 'local_time'
gem 'mission_control-jobs', '~> 0.5.0' # git: 'https://github.com/rails/mission_control-jobs.git', branch: 'main'

gem 'mysql2'
gem 'omniauth'
gem 'omniauth-keycloak'
gem 'omniauth-google-oauth2'
gem 'omniauth-rails_csrf_protection'
gem 'postmark-rails'
gem 'prophet-rb', '~> 0.5.3'
gem 'puma'
gem 'rails', '8.0.1'
gem 'rails-html-sanitizer'
gem 'rack-cors', '~> 2.0'
gem 'responders'
gem 'rubyzip', '~> 2.4.1' # 3.0 will be breaking
gem 'sassc-rails', '~> 2.1'
gem 'solid_cable', '~> 3.0'
gem 'solid_queue'
gem 'thor'
gem 'turbo-rails', '~> 2.0', '>= 2.0.5'
gem 'vega'

group :development, :test do
  # See https://guides.rubyonrails.org/debugging_rails_applications.html#debugging-with-the-debug-gem
  gem 'debug', platforms: [ :mri, :windows ], require: 'debug/prelude'
  gem 'bullet'
  gem 'memory_profiler'
end

group :development do
  # Use console on exceptions pages [https://github.com/rails/web-console]
  gem 'web-console'

  gem 'annotaterb', '~> 4.13'
  # this was commented out in the default build, so doing the same..
  # Add speed badges [https://github.com/MiniProfiler/rack-mini-profiler]
  # gem 'rack-mini-profiler'

  gem 'database_consistency', '~> 2.0', require: false
  gem 'debugbar'
  gem 'derailed_benchmarks'
  gem 'letter_opener'
  gem 'rubocop', require: false
  gem 'rubocop-rails', require: false
  gem 'rubocop-capybara', require: false
  gem 'rails-erd', '~> 1.6'
end

group :test do
  gem 'minitest-reporters', '>= 0.5.0'
  gem 'mocha', '~> 2.7'
  gem 'simplecov', require: false
  gem 'webmock'
  gem 'rails-controller-testing' # bring back compatibility with rails 4 assigns in controller tests.

  # Use system testing [https://guides.rubyonrails.org/testing.html#system-testing]
  gem 'capybara'
  gem 'selenium-webdriver'
end

gem 'mini_racer', '~> 0.16.0'
