# frozen_string_literal: true

source 'https://rubygems.org'

ruby '3.2.2'

gem 'activerecord-import', '>= 1.0.7'
gem 'acts_as_list', '>= 1.0.1'
gem 'angular-rails-templates', '>= 1.0.0.beta'
gem 'apipie-rails', '~> 1.2'
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
gem 'net-imap', '~> 0.3.0'
gem 'postmark-rails'
gem 'puma'
gem 'pundit'
gem 'rails', '= 7.0.4.3'
gem 'responders'
gem 'sidekiq'
gem 'terser'
gem 'bootsnap', require: false
gem 'listen', '~> 3.3'

gem 'cal-heatmap-rails', '~> 3.6' # provides assets for cal heatmap, that requires old d3
gem 'd3-rails', '~> 3.5.5' # For cal heatmap

# Using this as it wires in via Sprockets and I can't get npm version to work with the main app.
# Had no luck with js/svg approach ;-(
gem 'font-awesome-sass'

gem 'rack-cors', '~> 2.0'
gem 'foreman'
gem 'ancestry'

gem 'omniauth', '~> 2.0'
gem 'omniauth-keycloak'
gem 'omniauth-google-oauth2'
gem 'omniauth-rails_csrf_protection', '~> 1.0'

gem 'prophet-rb', '~> 0.5.0'
gem 'rails-healthcheck', '~> 1.4'
gem 'rails-html-sanitizer'

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
  gem 'webdrivers'
end
