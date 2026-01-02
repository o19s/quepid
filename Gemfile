# frozen_string_literal: true

source 'https://rubygems.org'

ruby '3.4.8'

gem 'active_storage_db'
gem 'acts_as_list'
gem 'addressable'
gem 'ahoy_matey'
gem 'ancestry'
gem 'bcrypt'
gem 'blazer'
gem 'bootsnap', require: false
gem 'colorize', require: false
gem 'devise'
gem 'devise_invitable'
gem 'faraday-retry'
gem 'foreman'
gem 'importmap-rails'
gem 'jbuilder'

gem 'listen'
gem 'local_time'
gem 'mini_racer'
gem 'mission_control-jobs' # git: 'https://github.com/rails/mission_control-jobs.git', branch: 'main'
gem 'mysql2'
gem 'oas_rails'
gem 'omniauth'
gem 'omniauth-keycloak'
gem 'omniauth-google-oauth2'
gem 'omniauth-rails_csrf_protection'
gem 'pagy'
gem 'postmark-rails'
gem 'prophet-rb'
gem 'puma'
gem 'rails', '8.1.1'
gem 'rails-html-sanitizer'
gem 'rack-cors'
gem 'responders'
gem 'rubyzip'
gem 'propshaft' # Modern asset pipeline for Rails 8
gem 'jsbundling-rails' # For bundling the Angular 1 app
gem 'scout_apm' # using on Heroku to look at memory issues
gem 'solid_cable'
gem 'solid_queue'
gem 'stimulus-rails'
gem 'thor'
gem 'turbo-rails'
gem 'vega'

gem 'ruby_llm'

group :development, :test do
  gem 'benchmark'
  # See https://guides.rubyonrails.org/debugging_rails_applications.html#debugging-with-the-debug-gem
  gem 'debug', platforms: [ :mri, :windows ], require: 'debug/prelude'
  gem 'bullet'
  gem 'memory_profiler'
  gem 'dotenv' # Enable .env file outside of Docker based environment
end

group :development do
  gem 'claude-on-rails' # Dev acceleration tool

  # Use console on exceptions pages [https://github.com/rails/web-console]
  gem 'web-console'
  gem 'annotaterb'

  # this was commented out in the default build, so doing the same..
  # Add speed badges [https://github.com/MiniProfiler/rack-mini-profiler]
  # gem 'rack-mini-profiler'

  gem 'database_consistency', require: false

  # This is useful in working on performance issues, but otherwise puts
  # a lot of noise in logs on startup
  # gem 'debugbar'

  gem 'derailed_benchmarks'
  gem 'letter_opener'
  gem 'rubocop', require: false
  gem 'rubocop-rails', require: false
  gem 'rubocop-capybara', require: false
  gem 'rails-erd'
end

group :test do
  gem 'minitest-reporters'
  gem 'simplecov', require: false
  gem 'webmock'
  gem 'rails-controller-testing' # bring back compatibility with rails 4 assigns in controller tests.

  # Use system testing [https://guides.rubyonrails.org/testing.html#system-testing]
  gem 'capybara'
  gem 'selenium-webdriver'
end
