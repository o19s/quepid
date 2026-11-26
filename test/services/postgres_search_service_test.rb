# frozen_string_literal: true

require 'test_helper'

class PostgresSearchServiceTest < ActiveSupport::TestCase
  cover 'PostgresSearchService*'

  MOVIES = "SELECT * FROM (VALUES ('603', 'The Matrix', 3), ('604', 'The Matrix Reloaded', 2), " \
           "('605', 'Up', 1)) AS movies(id, title, score) WHERE title ILIKE '%' || $1 || '%' ORDER BY score DESC"

  def search body, url: 'postgresql://db.example.com/movies', credentials: nil
    response = PostgresSearchService.new(Addressable::URI.parse(url), credentials: credentials).search(body.to_json)
    [ response.status, JSON.parse(response.body) ]
  end

  describe '.handles?' do
    it 'claims postgres and postgresql URLs only' do
      assert PostgresSearchService.handles?(Addressable::URI.parse('postgresql://db/movies'))
      assert PostgresSearchService.handles?(Addressable::URI.parse('postgres://db/movies'))
      assert_not PostgresSearchService.handles?(Addressable::URI.parse('https://db/movies'))
    end

    it 'claims nothing when POSTGRES_SEARCH_ENABLED is off' do
      original = Rails.application.config.postgres_search_enabled
      Rails.application.config.postgres_search_enabled = false

      assert_not PostgresSearchService.handles?(Addressable::URI.parse('postgresql://db/movies'))
    ensure
      Rails.application.config.postgres_search_enabled = original
    end
  end

  describe 'requests it refuses before connecting' do
    it 'needs an sql string' do
      status, body = search({ params: [ 'matrix' ] })

      assert_equal 400, status
      assert_match(/"sql"/, body['error'])
    end

    it 'needs params to be a list' do
      status, = search({ sql: MOVIES, params: 'matrix' })

      assert_equal 400, status
    end

    it 'blocks a host the proxy allowlist blocks' do
      status, body = search({ sql: MOVIES, params: [ 'matrix' ] }, url: 'postgresql://127.0.0.1/movies')

      assert_equal 400, status
      assert_equal 'Database host resolves to a disallowed address', body['error']
    end
  end

  describe 'connection settings' do
    def connect_params url
      original = PG.method(:connect)
      params = nil
      PG.define_singleton_method(:connect) do |**kwargs|
        params = kwargs
        raise PG::ConnectionBad, 'not connecting in this test'
      end
      search({ sql: 'SELECT 1 AS id' }, url: url)
      params
    ensure
      PG.define_singleton_method(:connect, original)
    end

    it 'decodes the user, password and database name in the URL' do
      params = connect_params('postgresql://al%20ice:p%40ss%3Aword@8.8.8.8/my%20db')

      assert_equal 'al ice', params[:user]
      assert_equal 'p@ss:word', params[:password]
      assert_equal 'my db', params[:dbname]
    end

    it 'requires TLS unless the URL says otherwise' do
      assert_equal 'require', connect_params('postgresql://8.8.8.8/movies')[:sslmode]
      assert_equal 'disable', connect_params('postgresql://8.8.8.8/movies?sslmode=disable')[:sslmode]
    end
  end

  # Runs against the test database's own server, so only when the suite runs on PostgreSQL
  # (the test-postgresql CI job, or DB_ADAPTER=postgresql locally).
  describe 'against a PostgreSQL server' do
    before do
      config = ActiveRecord::Base.connection_db_config.configuration_hash
      skip 'needs DB_ADAPTER=postgresql' unless 'postgresql' == config[:adapter]

      @url = "postgresql://#{config[:host] || '127.0.0.1'}:#{config[:port] || 5432}/#{config[:database]}?sslmode=disable"
      @admin_credentials = "#{config[:username]}:#{config[:password]}"
      @credentials = postgres_search_credentials || skip('needs a database user that can create roles')
    end

    def db_search body
      allowing_every_address { search(body, url: @url, credentials: @credentials) }
    end

    # The test database usually lives on loopback or a private network.
    def allowing_every_address
      original = ProxyAllowlist.instance_method(:blocked?)
      ProxyAllowlist.define_method(:blocked?) { |*, **| false }
      yield
    ensure
      ProxyAllowlist.define_method(:blocked?, original)
    end

    it 'returns rows in the order the SQL ranks them, with typed columns' do
      status, body = db_search({ sql: MOVIES, params: [ 'matrix' ] })

      assert_equal 200, status
      assert_equal [ { 'id' => '603', 'title' => 'The Matrix', 'score' => 3 },
                     { 'id' => '604', 'title' => 'The Matrix Reloaded', 'score' => 2 } ], body['rows']
    end

    it 'caps the rows at limit' do
      _, body = db_search({ sql: MOVIES, params: [ '' ], limit: 2 })

      assert_equal %w[603 604], body['rows'].pluck('id')
    end

    it 'runs SQL that ends in a line comment' do
      status, body = db_search({ sql: 'SELECT 1 AS id -- newest first', params: [] })

      assert_equal 200, status
      assert_equal [ { 'id' => 1 } ], body['rows']
    end

    it 'binds the query text, so SQL in it is only data' do
      _, body = db_search({ sql: 'SELECT $1::text AS id', params: [ "'); DROP TABLE users; --" ] })

      assert_equal "'); DROP TABLE users; --", body['rows'].first['id']
    end

    it 'binds a vector or object param as its JSON text' do
      _, body = db_search({ sql: "SELECT $1::jsonb->>1 AS id, $2::jsonb->>'k' AS title", params: [ [ 0.1, 0.2 ], { k: 'v' } ] })

      assert_equal [ { 'id' => '0.2', 'title' => 'v' } ], body['rows']
    end

    it 'refuses to write' do
      status, body = db_search({ sql: 'WITH gone AS (DELETE FROM users RETURNING id) SELECT * FROM gone' })

      assert_equal 400, status
      assert_match(/data-modifying|read-only/, body['error'])
    end

    it 'refuses a write hidden in a function call' do
      status, body = db_search({ sql: "SELECT nextval('users_id_seq') AS id" })

      assert_equal 400, status
      assert_match(/read-only transaction/, body['error'])
    end

    it 'refuses to search as a superuser' do
      status, body = allowing_every_address { search({ sql: 'SELECT 1 AS id' }, url: @url, credentials: @admin_credentials) }

      assert_equal 400, status
      assert_match(/superuser/, body['error'])
    end

    it 'reports a SQL error as a bad request' do
      status, body = db_search({ sql: 'SELECT * FROM no_such_table' })

      assert_equal 400, status
      assert_match(/no_such_table/, body['error'])
    end

    it 'reports a failed login as a bad gateway' do
      status, = allowing_every_address { search({ sql: 'SELECT 1 AS id' }, url: @url, credentials: 'nobody:wrong') }

      assert_equal 502, status
    end
  end
end
