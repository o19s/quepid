# frozen_string_literal: true

module Api
  module V1
    # @tags books > query doc pairs
    class QueryDocPairsController < Api::ApiController
      before_action :set_book
      before_action :check_book
      before_action :set_query_doc_pair,   only: [ :show, :update, :destroy ]
      before_action :check_query_doc_pair, only: [ :show, :update, :destroy ]

      def index
        @query_doc_pairs = @book.query_doc_pairs
        respond_with @query_doc_pairs
      end

      def show
        respond_with @query_doc_pair
      end

      # @summary Pick query doc pair to be judged
      # > Mostly randomly selects a query doc pair that needs to be judged, or none if they have all been judged.
      def to_be_judged
        judge = User.find(params[:judge_id])
        @query_doc_pair = SelectionStrategy.random_query_doc_based_on_strategy(@book, judge)

        if @query_doc_pair
          respond_with @query_doc_pair
        else
          head :no_content
        end
      end

      # @request_body Query Doc Pair to be created
      #   [
      #     !Hash{
      #       query_doc_pair: Hash{
      #         query_text: String,
      #         doc_id: String,
      #         position: Integer,
      #         document_fields: String,
      #         information_need: String,
      #         notes: String,
      #         options: Hash
      #       }
      #     }
      #   ]
      # @request_body_example basic query doc pair [Hash]
      #   {
      #     query_doc_pair: {
      #       query_text: "star wars",
      #       doc_id: "empire_strikes_back",
      #       position: 1
      #     }
      #   }
      # @request_body_example complete query doc pair [Hash]
      #   {
      #     query_doc_pair: {
      #       query_text: "star wars",
      #       doc_id: "return_of_the_jedi",
      #       position: 2,
      #       document_fields: "{\"overview\":\"A galaxy far far away...\",\"cast\":\"Mark Hamill\"",
      #       information_need: "classic science fiction movie",
      #       notes: "This is an important query",
      #       options: {"key":"value"}
      #     }
      #   }
      def create
        @query_doc_pair = @book.query_doc_pairs.find_or_create_by query_text: params[:query_doc_pair][:query_text],
                                                                  doc_id:     params[:query_doc_pair][:doc_id]

        update_params = query_doc_pair_params
        if @query_doc_pair.update update_params
          respond_with @query_doc_pair
        else
          render json: @query_doc_pair.errors, status: :bad_request
        end
      end

      # @request_body Query Doc Pair to be updated
      #   [
      #     !Hash{
      #       query_doc_pair: Hash{
      #         query_text: String,
      #         doc_id: String,
      #         position: Integer,
      #         document_fields: String,
      #         information_need: String,
      #         notes: String,
      #         options: Hash
      #       }
      #     }
      #   ]
      # @request_body_example basic query doc pair [Hash]
      #   {
      #     query_doc_pair: {
      #       position: 3
      #     }
      #   }
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
        params.expect(query_doc_pair: [ :document_fields, :position, :query_text, :doc_id, :notes,
                                        :information_need, { options: {} } ])
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
