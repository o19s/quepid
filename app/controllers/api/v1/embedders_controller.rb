# frozen_string_literal: true

module Api
  module V1
    # @tags embedders
    class EmbeddersController < Api::ApiController
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
      #         service_url: String,
      #         model: String,
      #         api_key: String,
      #         connection_id: Integer,
      #         dimensions: Integer,
      #         truncation: String,
      #         instruction: String,
      #         input_template: String,
      #         timeout: Integer,
      #         archived: Boolean,
      #         team_ids: Array<Integer>
      #       }
      #     }
      #   ]
      # @request_body_example OpenAI embedder
      #   [JSON{
      #     "embedder": {
      #       "name": "OpenAI small, 512 dims",
      #       "provider": "openai",
      #       "service_url": "https://api.openai.com",
      #       "model": "text-embedding-3-small",
      #       "api_key": "sk-...",
      #       "dimensions": 512,
      #       "truncation": "native"
      #     }
      #   }]
      #
      # With connection_id the embedder takes its provider, URL, key and timeout from that
      # connection (one the user can use whose service makes embeddings), and ignores its own.
      def create
        @embedder = current_user.owned_embedders.build(embedder_params.except(:team_ids))

        if usable_connection? && @embedder.save
          apply_team_ids(@embedder, embedder_params[:team_ids]) if embedder_params.key?(:team_ids)
          respond_with @embedder
        else
          render json: @embedder.errors, status: :bad_request
        end
      end

      # A blank or masked api_key leaves the saved key alone.
      # @request_body_example rename [JSON{ "embedder": { "name": "Renamed" }}]
      def update
        update_params = embedder_params.except(:team_ids)
        update_params = update_params.except(:api_key) if Embedder.keep_existing_key?(update_params[:api_key])

        @embedder.assign_attributes(update_params)

        if usable_connection? && @embedder.save
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
      end

      # Only teams the current user belongs to are added or removed; others are kept.
      def apply_team_ids embedder, team_ids
        user_team_ids = current_user.teams.pluck(:id)
        selected = Array(team_ids).compact_blank.map(&:to_i) & user_team_ids
        kept = embedder.team_ids - user_team_ids

        embedder.team_ids = kept | selected
      end

      # See EmbeddersController#usable_connection?.
      def usable_connection?
        id = @embedder.connection_id
        return true if id.nil? || id == @embedder.connection_id_was
        return true if current_user.connections_involved_with.exists?(id: id)

        @embedder.errors.add(:connection, "isn't one you can use")
        false
      end

      def embedder_params
        params.expect(embedder: [ *Embedder::PERMITTED_PARAMS, :archived, { team_ids: [] } ])
      end
    end
  end
end
