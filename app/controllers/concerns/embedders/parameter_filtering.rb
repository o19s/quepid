# frozen_string_literal: true

module Embedders
  module ParameterFiltering
    extend ActiveSupport::Concern

    private

    def permitted_embedder_params
      params.expect(embedder: embedder_parameter_keys)
    end

    def embedder_parameter_keys
      [ :name, :provider, :model, :dimensions, :truncation, :instruction, :input_template, :connection_id ]
    end
  end
end
