# frozen_string_literal: true

require 'rubygems/package'
require 'zlib'

# rubocop:disable Metrics/BlockLength

GZIPPED_BASE_PATH_FOR_NOTEBOOKS = '/srv/app/public/notebooks'
namespace :assets do
  # Does this actually do anything for us?
  desc 'Create .gz versions of assets'
  task gzip: :environment do
    zip_types = /\.(?:css|html|js|otf|svg|txt|xml)$/

    public_assets = Rails.public_path.join(Rails.application.config.assets.prefix)

    Dir["#{public_assets}/**/*"].each do |f|
      next unless !File.directory?(f) && f =~ zip_types

      mtime = File.mtime(f)
      gz_file = "#{f}.gz"
      next if File.exist?(gz_file) && File.mtime(gz_file) >= mtime

      File.open(gz_file, 'wb') do |dest|
        gz = Zlib::GzipWriter.new(dest, Zlib::BEST_COMPRESSION)
        gz.mtime = mtime.to_i
        IO.copy_stream(File.open(f), gz)
        gz.close
      end

      File.utime(mtime, mtime, gz_file)
    end
  end

  desc 'Unpack Jupyterlite assets'
  task jupyterlite: :environment do
    notebooks_zip = Rails.root.join('jupyterlite/notebooks.gz')
    destination = Rails.public_path.join('notebooks')

    Gem::Package::TarReader.new( Zlib::GzipReader.open(notebooks_zip) ) do |tar|
      dest = nil
      tar.each do |entry|
        entry_path = entry.full_name
        entry_path = entry_path[GZIPPED_BASE_PATH_FOR_NOTEBOOKS.length..]

        dest ||= File.join destination, entry_path
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
          File.symlink entry.header.linkname, dest
        end
        dest = nil
      end
    end
  end

  # Hook into existing assets:precompile task
  Rake::Task['assets:precompile'].enhance do
    Rake::Task['assets:gzip'].invoke
    Rake::Task['assets:jupyterlite'].invoke
  end
end

# rubocop:enable Metrics/BlockLength
