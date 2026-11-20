# frozen_string_literal: true

module ConnectionsHelper
  # The index page's "kind" tabs/filter, by query param - the single place both the controller
  # (deciding which param values are valid) and the view (rendering the tabs) read these from.
  KINDS = { 'ai' => 'AI & ML backends', 'search' => 'Search backends' }.freeze

  # A consumer form's connection dropdown (ADR 0005): a prompt, then every active connection the
  # user can select whose provider has one of `capabilities`, plus the one the record already has,
  # so a teammate can save an unchanged shared embedder or judge.
  def connection_options_for capabilities, record
    connections = selectable_connections(capabilities).order(:name).to_a
    connections |= [ record.connection ] if record.persisted? && record.connection

    options = connections.map do |connection|
      provider_label = connection.provider_definition&.label || connection.provider
      [ "#{connection.name} (#{provider_label})", connection.id,
        { data: { provider: connection.provider, url: connection.base_url, provider_label: provider_label } } ]
    end

    options_for_select([ [ 'Choose a connection', '' ] ] + options, record.connection_id)
  end

  # The active connections the user can select whose provider has one of `capabilities`.
  def selectable_connections capabilities
    providers = Array(capabilities).flat_map { |capability| ConnectionProvider.with_capability(capability).map(&:key) }
    current_user.connections_involved_with.not_archived.where(provider: providers)
  end

  # The mapper wizard's connection dropdown: every active chat connection the user can use.
  # Unlike connection_options_for, there is no persisted consumer to carry a sticky selection --
  # the wizard's choice is used once per request and never saved.
  def chat_connection_options
    options = chat_connections.map do |connection|
      provider_label = connection.provider_definition&.label || connection.provider
      [ "#{connection.name} (#{provider_label})", connection.id ]
    end

    options_for_select([ [ 'Choose a connection', '' ] ] + options)
  end

  # Is there a connection the mapper wizard can generate mapper code with? The view asks this
  # more than once per render (the empty-state warning, the disabled button), alongside
  # chat_connection_options -- memoized so they share one query instead of three.
  def chat_connection_offered?
    chat_connections.any?
  end

  private

  def chat_connections
    @chat_connections ||= selectable_connections(:chat).order(:name).to_a
  end
end
