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

    Gem::Package::TarReader.new( Zlib::GzipReader.open(notebooks_zip) ) do |tar|
      dest = nil
      tar.each do |entry|
        entry_path = entry.full_name
        puts entry_path
        dest ||= File.join destination, entry_path
        puts dest
        if entry.directory?
          FileUtils.rm_rf dest unless File.directory? dest
          FileUtils.mkdir_p dest, mode: entry.header.mode, verbose: false
        elsif entry.file?
          FileUtils.rm_rf dest unless File.file? dest
          File.open dest, 'wb' do |f|
            f.print entry.read
          end
          FileUtils.chmod entry.header.mode, dest, verbose: false
        elsif '2' == entry.header.typeflag # Symlink!
          puts "We have a symlink for dest: #{entry_path}"
          File.symlink entry.header.linkname, dest
        end
        dest = nil
      end
    end
  end

  # Hook into existing assets:precompile task
  Rake::Task['assets:precompile'].enhance do
    Rake::Task['assets:jupyterlite'].invoke
  end
end

# rubocop:enable Metrics/BlockLength
