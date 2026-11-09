# frozen_string_literal: true

require 'test_helper'

# == Schema Information
#
# Table name: connections
#
#  id                  :bigint           not null, primary key
#  archived            :boolean          default(FALSE), not null
#  auth_header         :string(100)
#  auth_scheme         :string(20)       default("bearer"), not null
#  base_url            :string(500)
#  extra_headers       :json
#  instance_wide       :boolean          default(FALSE), not null
#  name                :string(255)      not null
#  options             :json
#  provider            :string(50)       not null
#  requests_per_minute :integer          default(0), not null
#  secret              :string(4000)
#  timeout             :integer          default(30), not null
#  created_at          :datetime         not null
#  updated_at          :datetime         not null
#  owner_id            :integer          not null
#
# Indexes
#
#  index_connections_on_owner_id_and_id  (owner_id,id)
#
class ConnectionTest < ActiveSupport::TestCase
  let(:connection) { connections(:openai) }
  let(:doug) { users(:doug) }
  let(:random) { users(:random) }
  let(:joey) { users(:joey) }

  def build **overrides
    Connection.new({ name: 'Mine', provider: 'openai', base_url: 'https://api.openai.com',
                     auth_scheme: 'bearer', secret: 'sk-new', owner: doug }.merge(overrides))
  end

  describe 'who can use and change a connection' do
    test 'membership in the owners team does not grant connection access' do
      assert_includes doug.teams, teams(:shared)
      assert_includes random.teams, teams(:shared)
      assert_not_includes random.connections_involved_with, connection
    end

    test 'an ownerless connection is invalid' do
      assert_not build(owner: nil).valid?
    end

    test 'selectable by its owner and everyone if instance-wide' do
      assert_includes doug.connections_involved_with, connection
      assert_not_includes random.connections_involved_with, connection
      assert_includes random.connections_involved_with, connections(:instance_elasticsearch)
      assert_not_includes random.connections_involved_with, connections(:private_ollama)
      assert_not_includes doug.connections_involved_with, connections(:private_ollama)
    end

    test 'only the owner changes a private connection' do
      assert connection.manageable_by?(doug)
      assert_not connection.manageable_by?(random)
      assert_not connection.manageable_by?(nil)
    end

    test 'an instance-wide connection retains its owner and is managed by administrators only' do
      instance = connections(:instance_elasticsearch)

      assert_predicate instance, :instance_wide?
      assert_equal doug, instance.owner
      assert instance.manageable_by?(doug)
      assert_not instance.manageable_by?(random)
    end

    test 'deleting the owner deletes the connection without publishing it' do
      private_ollama = connections(:private_ollama)
      embedders(:private_ollama).destroy!
      joey.destroy

      assert_not Connection.exists?(private_ollama.id)
    end
  end

  describe 'validations' do
    test 'an instance-wide connection requires a human administrator as its owner' do
      assert_not build(owner: random, instance_wide: true).valid?
      assert_predicate build(instance_wide: true), :valid?
    end

    test 'a valid connection saves' do
      assert build.save
    end

    test 'a connection left unnamed is called after its provider' do
      assert_equal 'OpenAI Connection', build(name: '').tap(&:valid?).name
      assert_equal 'Voyage AI Connection', build(name: nil, provider: 'voyage', base_url: 'https://api.voyageai.com').tap(&:valid?).name
      assert_equal 'Mine', build.tap(&:valid?).name
    end

    test 'the default name follows the provider when it changes before saving' do
      connection = build(name: '')
      connection.provider = 'anthropic'
      connection.valid?

      assert_equal 'Anthropic Connection', connection.name
    end

    test 'requires a known provider' do
      assert_not build(provider: 'nope').valid?
    end

    test 'accepts complete http(s) URLs including local hosts and provider paths' do
      urls = [
        'https://api.openai.com',
        'HTTPS://api.openai.com/v1',
        'http://ollama:11434',
        'http://localhost:8080/v1/',
        'http://[::1]:11434/api',
        'https://example.com/provider/v1?api-version=2026-01-01'
      ]

      urls.each do |url|
        assert_predicate build(base_url: url), :valid?, url
      end
    end

    test 'rejects malformed URLs and unsupported schemes' do
      urls = [
        'https://',
        'https:///v1',
        'https://example.com:invalid',
        'https://example.com/with a space',
        "https://example.com\nhttps://other.example.com",
        'ftp://example.com',
        '//example.com'
      ]

      urls.each do |url|
        connection = build(base_url: url)

        assert_not connection.valid?, url
        assert_includes connection.errors[:base_url], 'must be a valid http:// or https:// URL'
      end
    end

    test 'strips a trailing slash from the URL' do
      assert_equal 'https://api.openai.com', build(base_url: ' https://api.openai.com/ ').tap(&:valid?).base_url
    end

    test 'a provider that always needs a key rejects a connection without one' do
      connection = build(secret: nil)

      assert_not connection.valid?
      assert_includes connection.errors[:secret].join, 'OpenAI'
    end

    test 'a keyless provider saves without a secret' do
      assert_predicate build(provider: 'ollama', base_url: 'http://ollama:11434', auth_scheme: 'none', secret: nil), :valid?
    end

    test 'the header scheme needs a valid header name, other schemes drop it' do
      assert_not build(auth_scheme: 'header', auth_header: '').valid?
      assert_not build(auth_scheme: 'header', auth_header: 'bad header').valid?
      assert_predicate build(auth_scheme: 'header', auth_header: 'x-api-key'), :valid?
      assert_nil build(auth_header: 'x-api-key').tap(&:valid?).auth_header
    end

    test 'a scheme of none drops any secret' do
      assert_nil build(provider: 'ollama', auth_scheme: 'none', secret: 'left-over').tap(&:valid?).secret
    end

    test 'basic needs user:password' do
      assert_not build(provider: 'elasticsearch', auth_scheme: 'basic', secret: 'nocolon').valid?
      assert_predicate build(provider: 'elasticsearch', auth_scheme: 'basic', secret: 'elastic:changeme'), :valid?
    end

    test 'timeout and rate limit must be in range' do
      assert_not build(timeout: 0).valid?
      assert_not build(timeout: 601).valid?
      assert_not build(requests_per_minute: -1).valid?
    end
  end

  describe 'the secret' do
    test 'is stored encrypted and masked for display' do
      saved = build(secret: 'sk-plain')
      saved.save!

      assert_not_equal 'sk-plain', saved.secret_before_type_cast
      assert_equal 'sk-plain', Connection.find(saved.id).secret
      assert_equal Connection::MASKED_SECRET, connection.masked_secret
    end

    test 'a basic secret shows its user name' do
      assert_equal 'elastic:******', connections(:instance_elasticsearch).masked_secret
    end

    test 'a blank or masked submitted secret means keep the saved one' do
      assert Connection.keep_existing_secret?('')
      assert Connection.keep_existing_secret?(nil)
      assert Connection.keep_existing_secret?('******')
      assert Connection.keep_existing_secret?('elastic:******')
      assert_not Connection.keep_existing_secret?('sk-other')
    end
  end

  describe 'request headers' do
    test 'bearer' do
      assert_equal({ 'Authorization' => 'Bearer sk-new' }, build.request_headers)
    end

    test 'basic encodes user:password' do
      headers = build(provider: 'elasticsearch', auth_scheme: 'basic', secret: 'elastic:changeme').request_headers

      assert_equal({ 'Authorization' => "Basic #{Base64.strict_encode64('elastic:changeme')}" }, headers)
    end

    test 'apikey' do
      assert_equal({ 'Authorization' => 'ApiKey abc' }, build(auth_scheme: 'apikey', secret: 'abc').request_headers)
    end

    test 'a custom header carries the secret' do
      headers = build(auth_scheme: 'header', auth_header: 'x-api-key', secret: 'abc').request_headers

      assert_equal({ 'x-api-key' => 'abc' }, headers)
    end

    test 'none sends no credentials but keeps the extra headers' do
      headers = build(provider: 'ollama', auth_scheme: 'none', secret: nil, extra_headers: { 'X-Team' => 'search' }).request_headers

      assert_equal({ 'X-Team' => 'search' }, headers)
    end
  end

  describe 'extra headers as text' do
    test 'parses one Name: value per line' do
      connection = build(extra_headers_text: "X-Team: search\n\nX-Trace: on: yes")

      assert_equal({ 'X-Team' => 'search', 'X-Trace' => 'on: yes' }, connection.extra_headers)
      assert_equal "X-Team: search\nX-Trace: on: yes", connection.extra_headers_text
    end

    test 'a line without a colon is an error' do
      connection = build(extra_headers_text: 'nonsense')

      assert_not connection.valid?
      assert_includes connection.errors[:extra_headers_text].join, 'Name: value'
    end
  end

  describe 'api version' do
    test 'is kept in options and cleared when blank' do
      connection = build(provider: 'azure_openai', api_version: '2024-06-01')
      assert_equal '2024-06-01', connection.options['api_version']

      connection.api_version = ''
      assert_nil connection.api_version
    end
  end

  describe 'retry settings' do
    test 'are left to the defaults until set' do
      connection = build

      assert_nil connection.retry_max
      assert_nil connection.retry_statuses
      assert_nil connection.retry_interval
      assert_empty connection.retry_options
    end

    test 'are kept in options, and only what is set overrides the defaults' do
      connection = build(retry_max: '5', retry_statuses_text: '429, 503 ,529', retry_interval: '0.5')

      assert_predicate connection, :valid?
      assert_equal({ max: 5, retry_statuses: [ 429, 503, 529 ], interval: 0.5 }, connection.retry_options)
      assert_equal '429, 503, 529', connection.retry_statuses_text

      connection.retry_statuses_text = ''
      connection.retry_interval = ''
      assert_equal({ max: 5 }, connection.retry_options)
    end

    test '0 retries is a setting, not blank' do
      assert_equal({ max: 0 }, build(retry_max: '0').retry_options)
    end

    test 'are checked' do
      assert_not build(retry_max: '11').valid?
      assert_not build(retry_max: '-1').valid?
      assert_not build(retry_interval: '61').valid?
      assert_not build(retry_statuses_text: '429, later').valid?
      assert_not build(retry_statuses_text: '99').valid?
    end

    test 'an embedder on the connection retries as it says' do
      voyage = connections(:voyage)
      voyage.update!(retry_max: 1, retry_statuses_text: '503', retry_interval: 0)
      embedder = Embedder.new(name: 'V', provider: 'voyage', model: 'voyage-3.5', owner: users(:doug), connection: voyage)
      stub = stub_request(:post, /api\.voyageai\.com/).to_return(status: 503, body: '{}')

      assert_raises(EmbedderAdapters::Error) { embedder.embed('star wars') }
      assert_requested stub, times: 2
    end
  end

  describe '#check' do
    let(:url) { 'https://api.openai.com/v1/models' }

    test 'ok when the provider accepts the credentials' do
      stub_request(:get, url).with(headers: { 'Authorization' => 'Bearer sk-new' }).to_return(status: 200, body: '{}')

      result = build.check

      assert_equal :ok, result.status
      assert_equal 200, result.http_status
    end

    test 'rejected on 401 or 403' do
      stub_request(:get, url).to_return(status: 401, body: '{}')

      assert_equal :rejected, build.check.status
    end

    test 'reachable when the provider answers but the check cannot confirm the credentials' do
      stub_request(:get, 'https://api.voyageai.com').to_return(status: 404, body: '')

      result = build(provider: 'voyage', base_url: 'https://api.voyageai.com').check

      assert_equal :reachable, result.status
      assert_match(/can't confirm/, result.message)
    end

    test 'unreachable when the connection fails' do
      stub_request(:get, url).to_timeout

      result = build.check

      assert_equal :unreachable, result.status
      assert_nil result.http_status
    end

    test 'sends the headers a provider insists on' do
      stub = stub_request(:get, 'https://api.anthropic.com/v1/models')
        .with(headers: { 'x-api-key' => 'abc', 'anthropic-version' => '2023-06-01' })
        .to_return(status: 200, body: '{}')

      build(provider: 'anthropic', base_url: 'https://api.anthropic.com', auth_scheme: 'header',
            auth_header: 'x-api-key', secret: 'abc').check

      assert_requested stub
    end

    test 'does not retry a rate limit: a check should answer quickly' do
      stub = stub_request(:get, url).to_return(status: 429, body: '{}')

      build.check

      assert_requested stub, times: 1
    end
  end
end
