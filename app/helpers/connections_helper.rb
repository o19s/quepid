# frozen_string_literal: true

module ConnectionsHelper
  # A consumer form's connection dropdown (ADR 0005): a prompt, then every active connection the
  # user can select whose provider has one of `capabilities`, plus the one the record already has,
  # so a teammate can save an unchanged shared embedder or judge.
  def connection_options_for capabilities, record
    connections = selectable_connections(capabilities).order(:name).to_a
    connections |= [ record.connection ] if record.persisted? && record.connection

    options = connections.map do |connection|
      provider_label = connection.provider_definition&.label || connection.provider
      [ "#{connection.name} (#{provider_label})#{' — no key yet' if connection.missing_secret?}", connection.id,
        { data: { provider: connection.provider, url: connection.base_url, provider_label: provider_label } } ]
    end

    options_for_select([ [ 'Choose a connection', '' ] ] + options, record.connection_id)
  end

  # The active connections the user can select whose provider has one of `capabilities`.
  def selectable_connections capabilities
    providers = Array(capabilities).flat_map { |capability| ConnectionProvider.with_capability(capability).map(&:key) }
    current_user.connections_involved_with.not_archived.where(provider: providers)
  end
end
