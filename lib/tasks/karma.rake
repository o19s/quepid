# frozen_string_literal: true

require 'colorize'

# rubocop:disable Metrics/BlockLength
namespace :karma  do
  desc 'Run karma tests in guard mode'
  task start: :environment do
    cleanup_assets
    result = with_tmp_config :start
    cleanup_assets
    exit result unless result
  end

  desc 'Run karma tests in single run mode'
  task run: :environment do
    cleanup_assets
    result = with_tmp_config :start, '--single-run'
    cleanup_assets
    exit result unless result
  end

  private

  def cleanup_assets
    puts 'Cleanup_assets...'.yellow

    rm_rf Rails.root.join('tmp/cache/assets/test')

    Rake.application['assets:environment'].invoke

    set_assets_path

    Rake.application['assets:clean'].reenable
    Rake.application['assets:clean'].invoke
    Rake.application['assets:clobber'].reenable
    sleep 10 # ugh, shouldn't be needed'
    Rake.application['assets:clobber'].invoke

    puts 'Finished cleaning up assets'.yellow
    puts '-' * 100
  end

  def with_tmp_config command, args = nil
    precompile_app_assets

    file = Tempfile.open('karma_unit.js', Rails.root.join('tmp') )

    begin
      file.write unit_js
      file.flush

      result = system("./node_modules/karma/bin/karma #{command} #{file.path} #{args}")
    ensure
      file.close
      file.unlink
    end

    puts 'Finished running karma tests'.yellow
    puts '-' * 100

    result
  end

  def unit_js
    File.read('spec/karma/config/unit.js')
  end

  def set_assets_path
    dir = Rails.root.join('tmp/assets').to_s

    # NOTE: Asset compilation is now handled by npm scripts, not Rails asset pipeline
  end

  # this method compiles all the same javascript files your app will
  def precompile_app_assets
    puts 'Precompiling assets...'.yellow
    # make sure the Rails environment is loaded
    Rake.application['assets:environment'].invoke

    set_assets_path

    # once the assets have been cleared, recompile them into the tmp directory
    Rake.application['assets:precompile'].reenable
    Rake.application['assets:precompile'].invoke
  end
end
# rubocop:enable Metrics/BlockLength
