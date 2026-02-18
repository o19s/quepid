# frozen_string_literal: true

module Jshint
  # Configuration object containing JSHint lint settings
  class Configuration
    # Returns the list of files that JSHint should lint over
    # relatives to the Application root
    #
    # @return [Array<String>] An Array of String files paths
    def files
      [ '**/*.js' ] # No need to put app/assets/ or vendor/assets here
    end

    def excluded_search_paths
      [ 'lib/assets/javascripts', 'vendor/assets/javascripts' ]
    end

    def included_search_paths
      []
    end

    def search_paths
      (default_search_paths + included_search_paths) - excluded_search_paths
    end

    def default_search_paths
      [
        'app/assets/javascripts',
        'vendor/assets/javascripts',
        'lib/assets/javascripts'
      ]
    end
  end
end
