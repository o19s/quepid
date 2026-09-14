# frozen_string_literal: true

module Api
  module V1
    # @tags mapper based search engines
    class MapperBasedSearchEnginesController < Api::ApiController
      def index
        @mapper_based_search_engines = MapperBasedSearchEngine.all

        respond_with @mapper_based_search_engines
      end
    end
  end
end
