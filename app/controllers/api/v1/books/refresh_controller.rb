# frozen_string_literal: true

module Api
  module V1
    module Books
      class RefreshController < Api::ApiController
        before_action :set_book, only: [ :update ]
        before_action :check_book, only: [ :update ]
        before_action :set_case, only: [ :update ]
        before_action :check_case, only: [ :update ]

        def update
          @create_missing_queries = deserialize_bool_param(params[:create_missing_queries])
          process_in_background = deserialize_bool_param(params[:process_in_background])

          # Create options hash for the RatingsManager
          options = { create_missing_queries: @create_missing_queries }

          @counts = {
            'queries_created'       => 0,
            'ratings_created'       => 0,
            'process_in_background' => true,
          }
          if process_in_background
            # For background processing with enhanced job
            # We can specify the case_id to process just that one case
            UpdateCaseJob.perform_later @book, options, @case
          else
            results = UpdateCaseJob.perform_now @book, options, @case
            @counts.merge!(results)
            @counts['process_in_background'] = false
          end

          respond_with @counts
        end
      end
    end
  end
end
