# frozen_string_literal: true

module Api
  module V1
    class QueryDocPairsController < Api::ApiController
      before_action :find_book
      before_action :check_book
      before_action :set_query_doc_pair,   only: [ :show, :update, :destroy ]
      before_action :check_query_doc_pair, only: [ :show, :update, :destroy ]

      def index
        @query_doc_pairs = @book.query_doc_pairs.includes([ :judgements ])

        respond_with @query_doc_pairs
      end

      def show
        respond_with @query_doc_pair
      end

      def create
        @query_doc_pair = @book.query_doc_pairs.build query_doc_pair_params

        if @query_doc_pair.save
          respond_with @query_doc_pair
        else
          render json: @query_doc_pair.errors, status: :bad_request
        end
      end

      def update
        update_params = query_doc_pair_params
        if @query_doc_pair.update update_params
          respond_with @query_doc_pair
        else
          render json: @query_doc_pair.errors, status: :bad_request
        end
      end

      def destroy
        @query_doc_pair.destroy
        render json: {}, status: :no_content
      end

      private

      def query_doc_pair_params
        params.require(:query_doc_pair).permit(:document_fields, :position, :query_text, :doc_id)
      end

      def find_book
        @book = current_user.books_involved_with.where(id: params[:book_id]).first
      end

      def check_book
        render json: { message: 'Book not found!' }, status: :not_found unless @book
      end

      def set_query_doc_pair
        @query_doc_pair = @book.query_doc_pairs.where(id: params[:id]).first
      end

      def check_query_doc_pair
        render json: { message: 'Query Doc Pair not found!' }, status: :not_found unless @query_doc_pair
      end
    end
  end
end
