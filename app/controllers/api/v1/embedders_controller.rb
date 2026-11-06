# frozen_string_literal: true

module Api
  module V1
    # @tags embedders
    class EmbeddersController < Api::ApiController
      include Embedders::ParameterFiltering
      include TeamAssignable

      before_action :set_embedder, only: [ :show, :update, :destroy ]

      # @parameter archived(query) [Boolean] Whether to list archived embedders instead of active ones.
      # @parameter team_id(path) [Integer] Only embedders shared with this team.
      def index
        archived = deserialize_bool_param(params[:archived])

        @embedders = current_user.embedders_involved_with.where(archived: archived).includes(:teams)
        @embedders = @embedders.joins(:teams).where(teams: { id: params[:team_id] }) if params[:team_id]

        respond_with @embedders
      end

      def show
        respond_with @embedder
      end

      # @request_body Embedder to be created
      #   [
      #     !Hash{
      #       embedder: Hash{
      #         name: String,
      #         provider: String,
      #         connection_id: Integer,
      #         model: String,
      #         dimensions: Integer,
      #         truncation: String,
      #         instruction: String,
      #         input_template: String,
      #         archived: Boolean,
      #         team_ids: Array<Integer>
      #       }
      #     }
      #   ]
      # @request_body_example OpenAI embedder
      #   [JSON{
      #     "embedder": {
      #       "name": "OpenAI small, 512 dims",
      #       "connection_id": 1,
      #       "model": "text-embedding-3-small",
      #       "dimensions": 512,
      #       "truncation": "native"
      #     }
      #   }]
      #
      # The embedder takes its provider, URL, key and timeout from connection_id (one the user can
      # use whose service makes embeddings) -- it has none of its own.
      def create
        @embedder = current_user.owned_embedders.build(embedder_params.except(:team_ids))
        @embedder.connection_assignment_user = current_user

        if @embedder.save
          apply_team_ids(@embedder, embedder_params[:team_ids]) if embedder_params.key?(:team_ids)
          respond_with @embedder
        else
          render json: @embedder.errors, status: :bad_request
        end
      end

      # @request_body_example rename [JSON{ "embedder": { "name": "Renamed" }}]
      def update
        update_params = embedder_params.except(:team_ids)

        if @embedder.update(update_params)
          apply_team_ids(@embedder, embedder_params[:team_ids]) if embedder_params.key?(:team_ids)
          respond_with @embedder
        else
          render json: @embedder.errors, status: :bad_request
        end
      end

      def destroy
        @embedder.destroy

        head :no_content
      end

      private

      def set_embedder
        @embedder = current_user.embedders_involved_with.find(params.expect(:id))
        @embedder.connection_assignment_user = current_user
      end

      def embedder_params
        params.expect(embedder: [ *embedder_parameter_keys, :archived, { team_ids: [] } ])
      end
    end
  end
end
