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
          @export = 'true' == params[:export]
          
          service = RatingsManager.new(@book)
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
