# frozen_string_literal: true

require 'test_helper'

class ConnectionTest < ActiveSupport::TestCase
  let(:connection) { connections(:openai) }
  let(:doug) { users(:doug) }
  let(:random) { users(:random) }
  let(:joey) { users(:joey) }

  def build **overrides
    Connection.new({ name: 'Mine', service: 'openai', base_url: 'https://api.openai.com',
                     auth_scheme: 'bearer', secret: 'sk-new', owner: doug }.merge(overrides))
  end

  describe 'who can use and change a connection' do
    test 'usable by its owner, a member of a team it is shared with, and everyone if instance-wide' do
      assert_includes doug.connections_involved_with, connection
      assert_includes random.connections_involved_with, connection
      assert_includes random.connections_involved_with, connections(:instance_elasticsearch)
      assert_not_includes random.connections_involved_with, connections(:private_ollama)
      assert_not_includes doug.connections_involved_with, connections(:private_ollama)
    end

    test 'only the owner changes it; a team member can use it but not manage it' do
      assert connection.manageable_by?(doug)
      assert_not connection.manageable_by?(random)
      assert_not connection.manageable_by?(nil)
    end

    test 'an instance-wide connection is managed by administrators only' do
      instance_wide = connections(:instance_elasticsearch)

      assert_predicate instance_wide, :instance_wide?
      assert instance_wide.manageable_by?(doug)
      assert_not instance_wide.manageable_by?(random)
    end

    test 'deleting the owner deletes the connection instead of making it instance-wide' do
      private_ollama = connections(:private_ollama)
      joey.destroy

      assert_not Connection.exists?(private_ollama.id)
    end
  end

  describe 'validations' do
    test 'a valid connection saves' do
      assert build.save
    end

    test 'a connection left unnamed is called after its service' do
      assert_equal 'OpenAI Connection', build(name: '').tap(&:valid?).name
      assert_equal 'Voyage AI Connection', build(name: nil, service: 'voyage', base_url: 'https://api.voyageai.com').tap(&:valid?).name
      assert_equal 'Mine', build.tap(&:valid?).name
    end

    test 'the default name follows the service when it changes before saving' do
      connection = build(name: '')
      connection.service = 'anthropic'
      connection.valid?

      assert_equal 'Anthropic Connection', connection.name
    end

    test 'requires a known service and an http(s) URL' do
      assert_not build(service: 'nope').valid?
      assert_not build(base_url: 'ftp://x').valid?
    end

    test 'strips a trailing slash from the URL' do
      assert_equal 'https://api.openai.com', build(base_url: ' https://api.openai.com/ ').tap(&:valid?).base_url
    end

    test 'a service that always needs a key rejects a connection without one' do
      connection = build(secret: nil)

      assert_not connection.valid?
      assert_includes connection.errors[:secret].join, 'OpenAI'
    end

    test 'a keyless service saves without a secret' do
      assert_predicate build(service: 'ollama', base_url: 'http://ollama:11434', auth_scheme: 'none', secret: nil), :valid?
    end

    test 'the header scheme needs a valid header name, other schemes drop it' do
      assert_not build(auth_scheme: 'header', auth_header: '').valid?
      assert_not build(auth_scheme: 'header', auth_header: 'bad header').valid?
      assert_predicate build(auth_scheme: 'header', auth_header: 'x-api-key'), :valid?
      assert_nil build(auth_header: 'x-api-key').tap(&:valid?).auth_header
    end

    test 'a scheme of none drops any secret' do
      assert_nil build(service: 'ollama', auth_scheme: 'none', secret: 'left-over').tap(&:valid?).secret
    end

    test 'basic needs user:password' do
      assert_not build(service: 'elasticsearch', auth_scheme: 'basic', secret: 'nocolon').valid?
      assert_predicate build(service: 'elasticsearch', auth_scheme: 'basic', secret: 'elastic:changeme'), :valid?
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
      headers = build(service: 'elasticsearch', auth_scheme: 'basic', secret: 'elastic:changeme').request_headers

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
      headers = build(service: 'ollama', auth_scheme: 'none', secret: nil, extra_headers: { 'X-Team' => 'search' }).request_headers

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
      connection = build(service: 'azure_openai', api_version: '2024-06-01')
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

    test 'an embedder on the connection retries as it says, and one with its own settings uses the defaults' do
      voyage = connections(:voyage)
      voyage.update!(retry_max: 1, retry_statuses_text: '503', retry_interval: 0)
      embedder = Embedder.new(name: 'V', provider: 'voyage', model: 'voyage-3.5', owner: users(:doug), connection: voyage)
      stub = stub_request(:post, /api\.voyageai\.com/).to_return(status: 503, body: '{}')

      assert_raises(EmbedderAdapters::Error) { embedder.embed('star wars') }
      assert_requested stub, times: 2

      assert_empty Embedder.new(service_url: 'http://x').retry_options
    end
  end

  describe '#check' do
    let(:url) { 'https://api.openai.com/v1/models' }

    test 'ok when the service accepts the credentials' do
      stub_request(:get, url).with(headers: { 'Authorization' => 'Bearer sk-new' }).to_return(status: 200, body: '{}')

      result = build.check

      assert_equal :ok, result.status
      assert_equal 200, result.http_status
    end

    test 'rejected on 401 or 403' do
      stub_request(:get, url).to_return(status: 401, body: '{}')

      assert_equal :rejected, build.check.status
    end

    test 'reachable when the service answers but the check cannot confirm the credentials' do
      stub_request(:get, 'https://api.voyageai.com').to_return(status: 404, body: '')

      result = build(service: 'voyage', base_url: 'https://api.voyageai.com').check

      assert_equal :reachable, result.status
      assert_match(/can't confirm/, result.message)
    end

    test 'unreachable when the connection fails' do
      stub_request(:get, url).to_timeout

      result = build.check

      assert_equal :unreachable, result.status
      assert_nil result.http_status
    end

    test 'sends the headers a service insists on' do
      stub = stub_request(:get, 'https://api.anthropic.com/v1/models')
        .with(headers: { 'x-api-key' => 'abc', 'anthropic-version' => '2023-06-01' })
        .to_return(status: 200, body: '{}')

      build(service: 'anthropic', base_url: 'https://api.anthropic.com', auth_scheme: 'header',
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
