# frozen_string_literal: true

require 'colorize'
require 'jshint/lint'

namespace :test do
  desc 'Run js/karma tests (equivalent of kamra:run)'
  task 'js' => 'karma:run'

  desc 'Run all tests: test:js, test:jshint, and test'
  task quepid: [ 'test:js', 'test:jshint', 'test' ]

  desc 'Run jshint on js files using configuration under config/jshint.yml'
  task jshint: :environment do
    puts '-' * 100
    puts 'Starting JSHint tests'.yellow

    linter = Jshint::Lint.new
    linter.lint

    if linter.errors?
      puts 'JSHint tests failed!'.red
      puts '-' * 100
      exit false
    else
      puts 'JSHint tests passed!'.green
      puts '-' * 100
    end
  end
end

namespace :db do
  namespace :seed do
    desc 'Runs db:seed with SEED_TEST set to true to seed DB with test accounts'
    task test: :environment do
      ENV['SEED_TEST'] = 'true' # apparently it has to be a string
      Rake::Task['db:seed'].invoke
    end

    task large: :environment do
      ENV['SEED_TEST']   = 'true'
      ENV['LARGE_SEEDS'] = 'true'
      Rake::Task['db:seed'].invoke
    end
  end
end
