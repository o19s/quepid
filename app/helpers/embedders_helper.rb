# frozen_string_literal: true

module EmbeddersHelper
  # The embedder form's connection dropdown: every active embedding connection the user can use.
  def embedder_connection_options embedder
    connection_options_for(:embeddings, embedder)
  end

  # Is there a connection the embedder's provider can use, so that the form has something to pick?
  def embedder_connection_offered? embedder
    connections = selectable_connections(:embeddings)
    embedder.provider.present? ? connections.exists?(provider: embedder.provider) : connections.exists?
  end
end
