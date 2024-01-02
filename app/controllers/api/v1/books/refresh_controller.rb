# frozen_string_literal: true

module Api
  module V1
    module Books
      class RefreshController < Api::ApiController
        before_action :find_book, only: [ :update ]
        before_action :check_book, only: [ :update ]
        before_action :set_case, only: [ :update ]
        before_action :check_case, only: [ :update ]

        def update
          @create_missing_queries = 'true' == params[:create_missing_queries]

          service = RatingsManager.new(@book, { create_missing_queries: @create_missing_queries })
          service.sync_ratings_for_case(@case)

          @counts = {}
          @counts['queries_created'] = service.queries_created
          @counts['ratings_created'] = service.ratings_created
          respond_with @counts
        end
      end
    end
  end
end
