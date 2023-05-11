# frozen_string_literal: true

require 'rubygems/package'
require 'zlib'

# rubocop:disable Metrics/BlockLength

#GZIPPED_BASE_PATH_FOR_NOTEBOOKS = '/notebooks'
namespace :assets do
  desc 'Unpack Jupyterlite assets'
  task jupyterlite: :environment do
    notebooks_zip = Rails.root.join('jupyterlite/notebooks.gz')
    destination = Rails.public_path

    puts "Destination is #{destination}"
    system "ls -alh"

    system "tar -xzf jupyterlite/notebooks.gz --directory #{destination}"
  end

  # Hook into existing assets:precompile task
  Rake::Task['assets:precompile'].enhance do
    Rake::Task['assets:jupyterlite'].invoke
  end
end

# rubocop:enable Metrics/BlockLength
