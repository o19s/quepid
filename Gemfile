# frozen_string_literal: true

source 'https://rubygems.org'

git_source(:github) do |repo_name|
  repo_name = "#{repo_name}/#{repo_name}" unless repo_name.include?('/')
  "https://github.com/#{repo_name}.git"
end

ruby '~> 2.5.5'

gem 'ace-rails-ap'
gem 'activerecord-import', '>= 0.13.0'
gem 'activerecord_any_of'
gem 'acts_as_list', github: 'swanandp/acts_as_list'
gem 'angular-rails-templates', '>= 1.0.0.beta'
gem 'bcrypt', '~> 3.1.7'
gem 'bootstrap-sass', '~> 3.3.5'
gem 'coffee-rails', '~> 4.1.0'
gem 'colorize', require: false
gem 'cookies_eu'
gem 'devise'
gem 'font-awesome-sass', '>= 4.4.0'
gem 'gabba'
gem 'intercom'
gem 'intercom-rails'
gem 'jbuilder', '~> 2.0'
gem 'jquery-rails'
gem 'jquery-ui-rails'
gem 'mysql2'
gem 'newrelic_rpm'
gem 'paranoia', '~> 2.0'
gem 'postmark-rails', '~> 0.10.0'
gem 'puma', '~> 3.7'
gem 'puma_worker_killer'
gem 'pundit'
gem 'rails', '~> 4.2', '>= 4.2.5.1'
gem 'responders'
gem 'rsolr', require: false
gem 'sass-rails', '~> 5.0'
gem 'sdoc', '~> 0.4.0', group: :doc
gem 'sidekiq'
gem 'sidetiq'
gem 'sinatra', require: false
gem 'slim'
gem 'uglifier', '>= 1.3.0'

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
  gem 'dotenv-rails'
  gem 'flamegraph'
  gem 'foreman'
  gem 'guard'
  gem 'guard-minitest'
  gem 'memory_profiler'
  gem 'rack-mini-profiler'
  gem 'spring', '1.6.4'
  gem 'stackprof'
  gem 'thin'
end

group :development do
  gem 'letter_opener'
  gem 'rubocop', require: false
  gem 'web-console', '~> 3.0'
end

group :test do
  gem 'database_cleaner'
  gem 'jasmine'
  gem 'm', '~> 1.5.0'
  gem 'minitest-reporters', '>= 0.5.0'
  gem 'mocha'
  gem 'simplecov', require: false
  gem 'timecop'
  gem 'webmock'

  source 'https://rails-assets.org' do
    gem 'rails-assets-angular-mocks'
  end
end

group :production, :staging do
  gem 'rails_12factor'
end

group :container do
  gem 'sqlite3'
end
