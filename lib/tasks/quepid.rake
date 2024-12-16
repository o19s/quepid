# frozen_string_literal: true

require 'colorize'
require 'jshint/lint'

namespace :test do
  desc 'Run js/karma tests (equivalent of karma:run)'
  task 'js' => 'karma:run'

  desc 'Run all frontend tasks: test:js, test:jshint'
  task frontend: :environment do
    Rake::Task['test:js'].invoke
    Rake::Task['test:jshint'].invoke
  end

  desc 'Run jshint on js files using configuration .jshintrc'
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

namespace :erd do
  desc 'Generate Entity Relationship Diagram'
  task image: :environment do
    system 'erd --inheritance --filetype=dot --direct --attributes=foreign_keys,content,inheritance'
    system 'dot -Tpng erd.dot > docs/erd.png'
    File.delete('erd.dot')
  end
end
