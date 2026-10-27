# frozen_string_literal: true

module Embedders
  # Backs the embedder form's Check connection button: embeds a sample text with the *current* form
  # values, saved or not, and reports what came back. Never writes to the database.
  #
  # Without an embedder_id the check runs on the unsaved form. With one, a blank key means
  # "use the saved one", since the form never shows it.
  class ConnectionChecksController < ApplicationController
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
      attributes = attributes.except(:api_key) if saved && Embedder.keep_existing_key?(attributes[:api_key])

      embedder = saved ? saved.dup : Embedder.new
      embedder.assign_attributes(attributes)
      # Testing before naming it is fine; the name doesn't affect the request.
      embedder.name = 'Untitled' if embedder.name.blank?
      embedder
    end

    def embedder_params
      params.expect(embedder: Embedder::PERMITTED_PARAMS)
    end
  end
end
