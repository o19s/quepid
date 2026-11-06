# frozen_string_literal: true

module EmbeddersHelper
  # The embedder form's connection dropdown: a prompt, then every active embedding connection the
  # user can use, plus the one already assigned so a teammate can save an unchanged shared embedder.
  def embedder_connection_options embedder
    providers = ConnectionProvider.with_capability(:embeddings).map(&:key)
    connections = current_user.connections_involved_with.not_archived.where(provider: providers).order(:name).to_a
    connections |= [ embedder.connection ] if embedder.persisted? && embedder.connection

    options = connections.map do |connection|
      provider_label = connection.provider_definition&.label || connection.provider
      [ "#{connection.name} (#{provider_label})", connection.id,
        { data: { provider: connection.provider, url: connection.base_url,
                  provider_label: provider_label } } ]
    end

    options_for_select([ [ 'Choose a connection', '' ] ] + options, embedder.connection_id)
  end

  # Is there a connection the embedder's provider can use, so that the form has something to pick?
  def embedder_connection_offered? embedder
    providers = ConnectionProvider.with_capability(:embeddings).map(&:key)
    connections = current_user.connections_involved_with.not_archived.where(provider: providers)
    embedder.provider.present? ? connections.exists?(provider: embedder.provider) : connections.exists?
  end
end
