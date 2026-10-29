# frozen_string_literal: true

module EmbeddersHelper
  # The embedder form's connection dropdown: no connection (the embedder keeps its own URL and
  # key), then every active connection the user can use that can make embeddings, plus the one the
  # embedder already has so saving doesn't silently unlink it. Only those for the embedder's
  # provider can be picked -- an Ollama embedder offers only Ollama connections -- so the others
  # are rendered disabled and hidden. They are still there because the provider can be changed on
  # the form, and the script then enables the ones for the new provider.
  def embedder_connection_options embedder
    services = ConnectionService.with_capability(:embeddings).map(&:key)
    connections = current_user.connections_involved_with.not_archived.where(service: services).order(:name).to_a
    connections |= [ embedder.connection ] if embedder.connection

    options = connections.map do |connection|
      fits = embedder.provider.blank? || embedder.provider == connection.service
      [ connection.name, connection.id,
        { disabled: !fits, hidden: !fits,
          data: { service: connection.service, url: connection.base_url,
                  service_label: connection.service_definition&.label || connection.service } } ]
    end

    options_for_select([ [ 'None: enter the URL and key here', '' ] ] + options, embedder.connection_id)
  end
end
