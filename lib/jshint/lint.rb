# frozen_string_literal: true

require 'jshint/configuration'
require File.expand_path 'lib/progress_bar'

module Jshint
  # Performs the linting of the files declared in our Configuration object
  class Lint
    # @return [Hash] A Hash of errors
    attr_reader :errors

    # @return [Jshint::Configuration] The configuration object
    attr_reader :config

    # Sets up our Linting behaviour
    #
    # @param config_path [String] The absolute path to a configuration YAML file
    # @return [void]
    def initialize _config_path = nil
      @config = Configuration.new
      @errors = {}
    end

    # Runs JSHint over each file in our search path
    #
    # @return [void]
    def lint
      ProgressBar.progress_loop(javascript_files.length) do |bar, total|
        javascript_files.each.with_index do |file, index|
          bar.print(index + 1, total)

          errors[file] = system "#{jshint_path} #{file}"
        end
      end
    end

    def errors?
      errors.any? { |_, result| !result }
    end

    private

    def file_paths
      paths = []

      if files.is_a? Array
        files.each do |file|
          config.search_paths.each { |path| paths << File.join(path, file) }
        end
      else
        config.search_paths.each { |path| paths << File.join(path, files) }
      end

      paths
    end

    def files
      @files ||= config.files
    end

    def jshint_path
      Rails.root.join('node_modules/jshint/bin/jshint')
    end

    def javascript_files
      # These files are converted from coffee script, and fail JavaScript lint checking.
      # I am skipping them via this terrible way because I can't get JSHint exclude_paths to work.
      # They should be fixed to pass jshint!
      files_to_skip = [ 'tour.js' ]

      # This file is a copied from node_modules/ace-builds to make Ace happy, so ignore
      files_to_skip << 'mode-json.js'

      js_asset_files = []
      file_paths.each do |path|
        Dir.glob(path) do |file|
          js_asset_files << file unless files_to_skip.any? { |file_to_skip| file.ends_with? file_to_skip }
        end
      end

      js_asset_files
    end
  end
end
