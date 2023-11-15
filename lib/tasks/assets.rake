# frozen_string_literal: true

require 'rubygems/package'
require 'zlib'

namespace :assets do
  desc 'Unpack Jupyterlite assets'
  task jupyterlite: :environment do
    notebooks_gz = Rails.root.join('notebooks.gz')
    destination = Rails.public_path
    notebooks_dir = Rails.public_path.join('notebooks')

    # Only deal with the compressed notebooks if we don't have the directory already.
    unless File.exist?(notebooks_dir)
      unless File.exist?(notebooks_gz)
        puts 'Downloading latest Quepid Notebooks from https://github.com/o19s/quepid-jupyterlite'
        system "wget --no-verbose -O #{notebooks_gz} https://github.com/o19s/quepid-jupyterlite/releases/latest/download/jupyter-lite-build.tgz"
      end

      puts "Unpacking Jupyterlite into #{destination}"
      system "tar -xzf #{notebooks_gz} --directory #{destination}"

      File.delete(notebooks_gz)
    end
  end

  # Hook into existing assets:precompile task
  Rake::Task['assets:precompile'].enhance do
    Rake::Task['assets:jupyterlite'].invoke if Rails.env.production?
  end
end
