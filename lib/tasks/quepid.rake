# frozen_string_literal: true

require 'colorize'
require 'jshint/lint'

namespace :test do
  desc 'Run js/karma tests (equivalent of kamra:run), but loads context properly'
  task 'js' => 'karma:run'

  desc 'Run js/karma watching changes to spec/ (equivalent of karma:start), but loads context properly'
  task 'js:start' => 'karma:start'

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
    desc 'Runs db:seed with SEED_SAMPLE_DATA set to true to seed DB with sample user accounts'
    task sample_users: :environment do
      ENV['SEED_SAMPLE_DATA'] = 'true' # apparently it has to be a string
      Rake::Task['db:seed'].invoke
    end

    desc 'Runs db:seed with SEED_SAMPLE_DATA and SEED_LARGE_CASES set to true to seed DB with lots of queries'
    task large_cases: :environment do
      ENV['SEED_SAMPLE_DATA'] = 'true'
      ENV['SEED_LARGE_CASES'] = 'true'
      Rake::Task['db:seed'].invoke
    end
  end
end
