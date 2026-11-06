# frozen_string_literal: true

module Embedders
  # Backs the embedder form's Check connection button: embeds a sample text with the *current* form
  # values, saved or not, and reports what came back. Never writes to the database. The key itself
  # is never on this form -- it comes from whichever connection is chosen.
  class ConnectionChecksController < ApplicationController
    include ParameterFiltering

    SAMPLE_TEXT = 'star wars'

    def create
      embedder = build_embedder
      unless embedder.valid?
        render json: { error: embedder.errors.full_messages.to_sentence }, status: :unprocessable_content
        return
      end

      render json: embedder.check(params[:text].presence || SAMPLE_TEXT).to_h
    rescue EmbedderAdapters::Error => e
      render json: { error: e.message }, status: :bad_gateway
    end

    private

    def build_embedder
      saved = current_user.embedders_involved_with.find(params.expect(:embedder_id)) if params.key?(:embedder_id)
      attributes = embedder_params

      # Keep the saved identity and original connection for the unchanged-connection access
      # checks. Assigning form values and validating only changes this in-memory instance.
      embedder = saved || Embedder.new
      # The one checking is who would use the connection.
      embedder.owner ||= current_user
      embedder.connection_assignment_user = current_user
      embedder.assign_attributes(attributes)
      # Testing before naming it is fine; the name doesn't affect the request.
      embedder.name = 'Untitled' if embedder.name.blank?
      embedder
    end

    def embedder_params
      permitted_embedder_params
    end
  end
end
