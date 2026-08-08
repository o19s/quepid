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

  desc 'Run js/karma tests (equivalent of karma:run)'
  task 'js' => 'karma:run'

  desc 'Run all frontend tasks: test:js, test:jshint, test:stylelint'
  task frontend: :environment do
    Rake::Task['test:js'].invoke
    Rake::Task['test:jshint'].invoke
    Rake::Task['test:stylelint'].invoke
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

  desc 'Run stylelint on app/assets/stylesheets using .stylelintrc.json'
  task stylelint: :environment do
    puts '-' * 100
    puts 'Starting Stylelint'.yellow

    stylelint = Rails.root.join('node_modules/.bin/stylelint')
    unless stylelint.executable?
      puts 'Stylelint not found; run: yarn install (or bin/docker r yarn install)'.red
      puts '-' * 100
      exit false
    end

    success = system(
      stylelint.to_s,
      'app/assets/stylesheets/**/*.css',
      chdir: Rails.root.to_s
    )

    if success
      puts 'Stylelint passed!'.green
      puts '-' * 100
    else
      puts 'Stylelint failed!'.red
      puts '-' * 100
      exit false
    end
  end
end
# rubocop:enable Metrics/BlockLength

namespace :erd do
  desc 'Generate Entity Relationship Diagram image at docs/erd.png'
  task image: :environment do
    # Framework/infrastructure tables that drown out our actual domain model in the diagram.
    # Excluding them keeps the Case/Query/Rating/Book story readable. New domain models show up
    # automatically; only this plumbing needs listing. See rails-erd#460 for the rationale.
    # NOTE: exclude is exact-name match only (no wildcards yet, see rails-erd#465), so list each one.
    infrastructure = %w[
      ActiveStorage::Attachment ActiveStorage::Blob ActiveStorage::VariantRecord
      ActiveStorageDB::File
      Ahoy::Event Ahoy::Visit
      Blazer::Audit Blazer::Check Blazer::Dashboard Blazer::DashboardQuery Blazer::Query
      SolidCable::Message
      SolidQueue::BlockedExecution SolidQueue::ClaimedExecution SolidQueue::FailedExecution
      SolidQueue::Job SolidQueue::Pause SolidQueue::Process SolidQueue::ReadyExecution
      SolidQueue::RecurringExecution SolidQueue::RecurringTask SolidQueue::ScheduledExecution
      SolidQueue::Semaphore
    ]

    # Render a PNG via Graphviz; Mermaid output is unreadably small for a schema this size.
    # Requires the ruby-graphviz gem and the graphviz system package (the `dot` binary).
    # docs/data_mapping.md embeds this image, so overwriting it here updates the doc in place.
    system 'bundle exec erd --generator=graphviz --filename=docs/erd --filetype=png ' \
           '--inheritance --direct ' \
           "--attributes=foreign_keys,content,inheritance --exclude=#{infrastructure.join(',')}"

    puts 'Generated ERD diagram at docs/erd.png (embedded in docs/data_mapping.md)'
  end
end
