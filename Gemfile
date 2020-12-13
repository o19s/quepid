# frozen_string_literal: true

source 'https://rubygems.org'

ruby '2.7.2'

gem 'ace-rails-ap'
gem 'activerecord-import', '>= 1.0.7'
gem 'acts_as_list', '>= 1.0.1'
gem 'angular-rails-templates', '>= 1.0.0.beta'
gem 'bcrypt', '~> 3.1.7'
gem 'bootstrap-sass', '~> 3.3.5'
gem 'coffee-rails', '~> 4.2'
gem 'turbolinks', '~> 5'
gem 'colorize', require: false
gem 'cookies_eu'
gem 'devise', '>= 4.6.2'
gem 'devise_invitable', '~> 2.0'
gem 'font-awesome-sass', '>= 4.4.0'
gem 'gabba'
gem 'intercom-rails'
gem 'jbuilder', '~> 2.5'
gem 'redis', '~> 4.0'
gem 'jquery-rails'
gem 'jquery-ui-rails' # Can we narrow the widgets to load faster?
gem 'mysql2'
gem 'postmark-rails', '~> 0.10.0'
gem 'puma', '~> 3.11'
gem 'puma_worker_killer'
gem 'pundit'
gem 'rails', '~> 5.2.4', '>= 5.2.4.4'
gem 'responders'
gem 'sass-rails', '~> 5.0'
gem 'sidekiq'
gem 'uglifier', '>= 1.3.0'
gem 'bootsnap', '~> 1.5'
gem 'listen', '~> 3.3'

source 'https://rails-assets.org' do
  gem 'rails-assets-angular'
  gem 'rails-assets-angular-cache'
  gem 'rails-assets-cal-heatmap'
  gem 'rails-assets-d3', '~> 3.5.5'
end

group :development, :test do
  gem 'annotate'
  gem 'bullet'
  gem 'byebug'
  gem 'foreman'
  gem 'memory_profiler'
  gem 'rack-mini-profiler'
end

group :development do
  gem 'letter_opener'
  gem 'rubocop', require: false
  gem 'rubocop-rails', require: false
end

group :test do
  gem 'minitest-reporters', '>= 0.5.0'
  gem 'mocha', '~> 1.11'
  gem 'simplecov', require: false
  gem 'webmock'
  gem 'rails-controller-testing' # bring back compatibility with rails 4 assigns in controller tests.
end
