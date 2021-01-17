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
    def initialize config_path = nil
      @config = Configuration.new(config_path)
      @errors = {}

      generate_jshintrc_file
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

    def jshintrc_options
      @jshintrc_options ||= config.jshintrc_options
    end

    def jshint_path
      Rails.root.join('node_modules/jshint/bin/jshint')
    end

    def javascript_files
      js_asset_files = []
      file_paths.each do |path|
        Dir.glob(path) do |file|
          js_asset_files << file
        end
      end

      js_asset_files
    end

    def generate_jshintrc_file
      output_file = File.open(Rails.root.join('.jshintrc'), 'w+')
      output_file.write(jshintrc_options)
      output_file.close
    end
  end
end
