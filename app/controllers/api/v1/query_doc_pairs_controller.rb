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
        # @query_doc_pair = @book.query_doc_pairs.build query_doc_pair_params
        @query_doc_pair = @book.query_doc_pairs.find_or_create_by query_text: params[:query_doc_pair][:query_text],
                                                                  doc_id:     params[:query_doc_pair][:doc_id]

        @query_doc_pair.position = params[:query_doc_pair][:position] unless params[:query_doc_pair][:position].nil?
        unless params[:query_doc_pair][:document_fields].nil?
          @query_doc_pair.document_fields = params[:query_doc_pair][:document_fields].to_json
        end
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
        head :no_content
      end

      private

      def query_doc_pair_params
        params.require(:query_doc_pair).permit(:document_fields, :position, :query_text, :doc_id)
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
