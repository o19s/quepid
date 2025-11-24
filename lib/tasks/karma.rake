# frozen_string_literal: true

require 'colorize'

namespace :karma do
  desc 'Run karma tests in watch mode'
  task start: :environment do
    run_karma('start')
  end

  desc 'Run karma tests in single run mode'
  task run: :environment do
    run_karma('start', '--single-run')
  end

  desc 'Run karma tests in CI mode (headless, single run)'
  task ci: :environment do
    run_karma('start', '--single-run')
  end

  private

  def run_karma(command, *args)
    puts 'Building assets...'.yellow
    system('npm run build') || exit(1)

    puts 'Running karma tests...'.yellow
    result = system("./node_modules/karma/bin/karma #{command} spec/karma/config/unit.js #{args.join(' ')}")

    puts 'Finished running karma tests'.yellow
    puts '-' * 100

    exit(1) unless result
  end
end
