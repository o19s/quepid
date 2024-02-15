# frozen_string_literal: true

module Api
  module V1
    module Import
      class BooksController < Api::ApiController
        api!
        # rubocop:disable Metrics/MethodLength
        def create
          team_id = params.require(:team_id)
          params_to_use = book_params.to_h.deep_symbolize_keys

          @book = Book.new

          @book.teams << Team.find(team_id)
          options = {}
          service = ::BookImporter.new @book, params_to_use, options

          service.validate

          unless @book.errors.empty?
            render json: @book.errors, status: :bad_request
            return
          end

          if service.import
            respond_with @book
          else
            render json: @book.errors, status: :bad_request
          end
        end
        # rubocop:enable Metrics/MethodLength

        private

        def book_params
          params.require(:book).permit!
        end
      end
    end
  end
end
