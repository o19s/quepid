# frozen_string_literal: true

require 'colorize'
require 'jshint/lint'

# rubocop:disable Metrics/BlockLength
namespace :test do
  desc 'Report failed tests from JUnit XML reports'
  task report_failed_tests: :environment do
    begin
      require 'nokogiri'
    rescue LoadError
      puts "This task requires nokogiri. Add it to your Gemfile or install it with 'gem install nokogiri'".red
      exit 1
    end

    report_dir = Rails.root.join('test/reports')
    xml_files = Dir.glob(File.join(report_dir, '*.xml'))

    if xml_files.empty?
      puts "No test report XML files found in #{report_dir}".yellow
      puts 'Run your tests first with Minitest::Reporters::JUnitReporter enabled'
      exit 0
    end

    failure_count = 0
    error_count = 0

    xml_files.each do |file|
      doc = Nokogiri::XML(File.read(file))

      # Get test suite name from the file
      suite_name = File.basename(file, '.xml')

      # Find all failed test cases
      failures = doc.xpath('//testcase[failure]')
      errors = doc.xpath('//testcase[error]')

      next unless failures.any? || errors.any?

      puts "Test Suite: #{suite_name}".red

      failures.each do |test|
        failure_count += 1
        puts "  ❌ #{test['name']} (#{test['classname']})".red
        puts "     Failure: #{test.xpath('failure').first['message']}".yellow
        puts ''
      end

      errors.each do |test|
        error_count += 1
        puts "  ⚠️  #{test['name']} (#{test['classname']})".red
        puts "     Error: #{test.xpath('error').first['message']}".yellow
        puts ''
      end
    end

    if failure_count.positive? || error_count.positive?
      puts "Summary: #{failure_count} failures, #{error_count} errors found across #{xml_files.size} test suites".red
      exit 1
    else
      puts "All tests passed in #{xml_files.size} test suites!".green
    end
  end

  desc 'Run JS unit tests (Vitest)'
  task 'js' => 'vitest:run'

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
# rubocop:enable Metrics/BlockLength

namespace :erd do
  desc 'Generate Entity Relationship Diagram'
  task image: :environment do
    system 'erd --inheritance --filetype=dot --direct --attributes=foreign_keys,content,inheritance'
    system 'dot -Tpng erd.dot > docs/erd.png'
    File.delete('erd.dot')
  end
end
