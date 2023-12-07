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
          service = RatingsManager.new(@book)
          service.sync_ratings_for_case(@case)

          @counts = {}
          @counts['queries_created'] = service.query_count
          @counts['ratings_created'] = service.rating_count
          respond_with @counts
        end
      end
    end
  end
end
