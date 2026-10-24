# frozen_string_literal: true

module Embedders
  # Backs the embedder form's Test button: embeds a sample text with the *current* form
  # values, saved or not, and reports what came back. Never writes to the database.
  #
  # embedder_id is a real id or the literal 'new'. For a saved embedder a blank key means
  # "use the saved one", since the form never shows it.
  class TestsController < ApplicationController
    SAMPLE_TEXT = 'star wars'

    # How many leading components to echo back -- enough to see it's a real vector.
    PREVIEW_SIZE = 5

    def create
      embedder = build_embedder
      unless embedder.valid?
        render json: { error: embedder.errors.full_messages.to_sentence }, status: :unprocessable_content
        return
      end

      text = params[:text].presence || SAMPLE_TEXT
      started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      vector = embedder.embed([ text ]).first
      elapsed_ms = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - started) * 1000).round

      render json: {
        input:      embedder.render_input(text),
        dimensions: vector.size,
        preview:    vector.first(PREVIEW_SIZE),
        elapsed_ms: elapsed_ms,
      }
    rescue EmbedderAdapters::Error => e
      render json: { error: e.message }, status: :bad_gateway
    end

    private

    def build_embedder
      saved = current_user.embedders_involved_with.find_by(id: params[:embedder_id]) if 'new' != params[:embedder_id]
      attributes = embedder_params
      attributes = attributes.except(:api_key) if saved && (attributes[:api_key].blank? || Embedder::MASKED_API_KEY == attributes[:api_key])

      embedder = saved ? saved.dup : Embedder.new
      embedder.assign_attributes(attributes)
      # Testing before naming it is fine; the name doesn't affect the request.
      embedder.name = 'Untitled' if embedder.name.blank?
      embedder
    end

    def embedder_params
      params.expect(embedder: [ :name, :provider, :service_url, :model, :api_key, :dimensions,
                                :truncation, :instruction, :input_template, :timeout ])
    end
  end
end
