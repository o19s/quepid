# frozen_string_literal: true

source 'https://rubygems.org'

ruby '3.2.0'

gem 'activerecord-import', '>= 1.0.7'
gem 'acts_as_list', '>= 1.0.1'
gem 'angular-rails-templates', '>= 1.0.0.beta'
gem 'bcrypt', '~> 3.1.7'
gem 'sassc-rails', '~> 2.1'
gem 'turbolinks', '~> 5'
gem 'colorize', require: false
gem 'cookies_eu'
gem 'devise', '>= 4.6.2'
gem 'devise_invitable', '~> 2.0'
gem 'gabba'
gem 'intercom-rails'
gem 'jbuilder', '~> 2.7'
gem 'redis', '~> 5.0.6'
gem 'jquery-rails'
gem 'jquery-ui-rails' # Can we narrow the widgets to load faster?
gem 'mysql2'

gem 'net-smtp'
gem 'net-pop', '~> 0.1.1'
gem 'net-imap', '~> 0.2.3'
gem 'postmark-rails'
gem 'puma'
gem 'pundit'
gem 'rails', '= 7.0.4.2'
gem 'responders'
gem 'sidekiq'
gem 'terser'
gem 'bootsnap', '>= 1.4.4', require: false
gem 'listen', '~> 3.3'

gem 'cal-heatmap-rails', '~> 3.6' # provides assets for cal heatmap, that requires old d3
gem 'd3-rails', '~> 3.5.5' # For cal heatmap

# Using this as it wires in via Sprockets and I can't get npm version to work with the main app.
# Had no luck with js/svg approach ;-(
gem 'font-awesome-sass'

gem 'rack-cors', '~> 1.1'
gem 'foreman'
gem 'racc', '~> 1.4.0'
gem 'ancestry'

gem 'omniauth', '~> 2.0'
gem 'omniauth-keycloak'
gem 'omniauth-rails_csrf_protection'
gem 'omniauth-google-oauth2'

gem 'rails-healthcheck', '~> 1.4'

gem 'vega', '~> 0.3.0'

group :development, :test do
  gem 'annotate'
  gem 'bullet'
  gem 'byebug'
  gem 'memory_profiler'
  gem 'rack-mini-profiler', '>= 2.3.3'
end

group :development do
  gem 'derailed_benchmarks'
  gem 'letter_opener'
  gem 'rubocop', require: false
  gem 'rubocop-rails', require: false
  gem 'rails-erd', '~> 1.6'
end

group :test do
  gem 'minitest-reporters', '>= 0.5.0'
  gem 'mocha', '~> 1.11'
  gem 'simplecov', require: false
  gem 'webmock'
  gem 'rails-controller-testing' # bring back compatibility with rails 4 assigns in controller tests.
end
