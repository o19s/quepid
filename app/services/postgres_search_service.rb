# frozen_string_literal: true

require 'ipaddr'
require 'pg'

# Runs a search endpoint's SQL against a PostgreSQL database and answers like an HTTP
# search API, so the PostgreSQL mapper preset goes through the same proxy and FetchService
# paths as Vespa and Qdrant (HttpClientService hands postgresql:// URLs here).
#
# The request body is {"sql": "SELECT ...", "params": ["#$query##", ...], "limit": 10}. The query text
# only ever reaches the database as a bind parameter ($1, $2, ...), never spliced into the
# SQL. The SQL itself is the case author's, so it is wrapped as a subquery (only a SELECT
# fits there) and runs in a read-only transaction with a statement timeout; the database
# role in the endpoint's credentials should still be read-only (docs/endpoints_postgresql.md),
# and a superuser login is refused, since a SELECT can call functions that act outside it.
class PostgresSearchService
  SCHEMES = %w[postgres postgresql].freeze
  MAX_ROWS = 1000
  STATEMENT_TIMEOUT = '10s'

  # When disabled (POSTGRES_SEARCH_ENABLED), postgres:// URLs fall through to the HTTP checks,
  # which refuse them.
  def self.handles? uri
    Rails.application.config.postgres_search_enabled && SCHEMES.include?(uri.scheme)
  end

  def initialize uri, credentials: nil, sslmode: nil
    @uri = uri
    @credentials = credentials.presence || Addressable::URI.unencode_component(uri.userinfo)
    # Not libpq's 'prefer': that falls back to plaintext, which an attacker can force.
    @sslmode = sslmode.presence || uri.query_values&.fetch('sslmode', nil) || 'require'
  end

  # Returns a Faraday::Response so callers handle it like any search API response.
  def search body
    request = JSON.parse(body.to_s)
    return respond(400, error: 'Expected a JSON body like {"sql": "SELECT ...", "params": [...]}') unless valid_request?(request)

    address = allowed_address
    return respond(400, error: 'Database host resolves to a disallowed address') if address.nil?

    respond(200, rows: query(address, request['sql'], request['params'] || [], row_limit(request['limit'])))
  rescue JSON::ParserError
    respond(400, error: 'Request body is not JSON')
  rescue PG::ConnectionBad => e
    respond(502, error: e.message)
  rescue PG::Error => e
    respond(400, error: e.message)
  end

  private

  def valid_request? request
    request.is_a?(Hash) && request['sql'].is_a?(String) && request['sql'].present? &&
      (request['params'].nil? || request['params'].is_a?(Array))
  end

  def row_limit limit
    limit.is_a?(Integer) && limit.positive? ? [ limit, MAX_ROWS ].min : MAX_ROWS
  end

  # Same allowlist the HTTP proxy applies. The connection is pinned to the checked address
  # (hostaddr) so DNS cannot answer differently between the check and the connect.
  def allowed_address
    addresses = Addrinfo.getaddrinfo(@uri.hostname, nil, :UNSPEC, :STREAM).map { |info| IPAddr.new(info.ip_address) }
    allowlist = ProxyAllowlist.new
    return nil if addresses.empty? || addresses.any? { |address| allowlist.blocked?(address, hostname: @uri.hostname) }

    addresses.first.to_s
  rescue SocketError, IPAddr::InvalidAddressError
    nil
  end

  def query address, sql, params, limit
    connection = connect(address)
    # The server reports is_superuser at login, so this costs no round trip.
    raise PG::Error, 'Refusing to search as a superuser; use a read-only role' if 'on' == connection.parameter_status('is_superuser')

    connection.transaction do
      connection.exec('SET TRANSACTION READ ONLY')
      connection.exec("SET LOCAL statement_timeout = '#{STATEMENT_TIMEOUT}'")
      # Order of the inner SELECT is kept: Postgres does not reorder a subquery under a bare LIMIT.
      # The newline keeps a trailing -- comment in the SQL from swallowing the closing parenthesis.
      connection.exec_params(
        "SELECT * FROM (#{sql.strip.delete_suffix(';')}\n) AS quepid_search LIMIT #{limit}",
        params.map { |param| bind_value(param) }
      ).to_a
    end
  ensure
    connection&.close
  end

  # shortcut: a new connection per query, so a background run pays connect/TLS/auth for every
  # query; keep one connection per endpoint in FetchService if those runs get slow.
  def connect address
    user, password = @credentials.to_s.split(':', 2)
    connection = PG.connect(
      host:            @uri.hostname,
      hostaddr:        address,
      port:            @uri.port || 5432,
      dbname:          Addressable::URI.unencode_component(@uri.path.to_s.delete_prefix('/')).presence,
      user:            user.presence,
      password:        password,
      sslmode:         @sslmode,
      connect_timeout: 10
    )
    connection.type_map_for_results = PG::BasicTypeMapForResults.new(connection).tap do |type_map|
      # Types pg has no decoder for (e.g. pgvector's vector) come back as their text form.
      type_map.default_type_map = PG::TypeMapAllStrings.new
    end
    connection
  end

  # A filled-in vector or object arrives as JSON; its JSON text is what pgvector
  # ('[0.1, 0.2]'::vector) and jsonb accept.
  def bind_value param
    param.is_a?(String) || param.nil? ? param : param.to_json
  end

  def respond status, payload
    Faraday::Response.new(
      status:           status,
      body:             payload.to_json,
      response_headers: { 'content-type' => 'application/json' }
    )
  end
end
