# frozen_string_literal: true

require 'colorize'

namespace :vitest do
  desc 'Run Vitest in watch mode'
  task start: :environment do
    run_vitest
  end

  desc 'Run Vitest once (single run)'
  task run: :environment do
    run_vitest('run')
  end

  desc 'Run Vitest in CI mode (single run)'
  task ci: :environment do
    run_vitest('run')
  end

  private

  def run_vitest(*args)
    puts 'Running Vitest...'.yellow
    result = system("yarn vitest #{args.join(' ')}")

    puts 'Finished running Vitest'.yellow
    puts '-' * 100

    exit(1) unless result
  end
end
