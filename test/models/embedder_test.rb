# frozen_string_literal: true

require 'test_helper'

# == Schema Information
#
# Table name: embedders
#
#  id             :bigint           not null, primary key
#  api_key        :string(4000)
#  archived       :boolean          default(FALSE), not null
#  connection_id  :bigint
#  dimensions     :integer
#  input_template :text(65535)
#  instruction    :text(65535)
#  model          :string(255)      not null
#  name           :string(255)      not null
#  options        :json
#  provider       :string(50)       not null
#  service_url    :string(500)
#  timeout        :integer          default(30), not null
#  truncation     :string(20)       default("none"), not null
#  created_at     :datetime         not null
#  updated_at     :datetime         not null
#  owner_id       :integer
#
# Indexes
#
#  index_embedders_on_connection_id    (connection_id)
#  index_embedders_on_owner_id_and_id  (owner_id,id)
#
class EmbedderTest < ActiveSupport::TestCase
  def build_embedder attributes = {}
    Embedder.new({
      name:        'Test',
      provider:    'openai',
      service_url: 'https://api.openai.com',
      model:       'text-embedding-3-small',
      api_key:     'sk-test',
    }.merge(attributes))
  end

  describe 'validations' do
    test 'a minimal embedder is valid' do
      assert_predicate build_embedder, :valid?
    end

    test 'rejects an unknown provider' do
      embedder = build_embedder(provider: 'nope')

      assert_not embedder.valid?
      assert_includes embedder.errors[:provider], 'is not a known provider'
    end

    test 'requires an http(s) service url' do
      assert_not build_embedder(service_url: 'api.openai.com').valid?
      assert_not build_embedder(service_url: '').valid?
    end

    test 'requires dimensions when truncating' do
      embedder = build_embedder(truncation: 'client')

      assert_not embedder.valid?
      assert_predicate embedder.errors[:dimensions], :any?
    end

    test 'drops dimensions when not truncating' do
      embedder = build_embedder(truncation: 'none', dimensions: 256)

      assert_predicate embedder, :valid?
      assert_nil embedder.dimensions
    end

    test 'native truncation is limited to the sizes the provider allows' do
      assert_not build_embedder(provider: 'voyage', truncation: 'native', dimensions: 300).valid?
      assert_predicate build_embedder(provider: 'voyage', truncation: 'native', dimensions: 1024), :valid?
      assert_predicate build_embedder(truncation: 'native', dimensions: 300), :valid?
    end

    test 'OpenAI and Voyage need a key; Ollama does not' do
      embedder = build_embedder(api_key: nil)

      assert_not embedder.valid?
      assert_includes embedder.errors[:api_key], 'is required for OpenAI'
      assert_not build_embedder(provider: 'voyage', api_key: '').valid?
      assert_predicate build_embedder(provider: 'ollama', service_url: 'http://ollama:11434', api_key: nil), :valid?
    end

    test 'input template must contain {query}' do
      embedder = build_embedder(provider: 'ollama', input_template: 'Instruct: {instruction}')

      assert_not embedder.valid?
      assert_includes embedder.errors[:input_template], 'must contain {query}'
    end

    test 'instruction and template are dropped for providers that do not take them' do
      embedder = build_embedder(instruction: 'Find things', input_template: 'q: {query}')

      assert_predicate embedder, :valid?
      assert_nil embedder.instruction
      assert_nil embedder.input_template
    end
  end

  describe '#check' do
    def stub_embeddings response
      stub_request(:post, 'https://api.openai.com/v1/embeddings').to_return(response.merge(headers: { 'Content-Type' => 'application/json' }))
    end

    test 'reports the text sent, the vector size, a preview and the time taken' do
      vector = Array.new(8) { |i| i / 10.0 }
      stub_embeddings(status: 200, body: { data: [ { index: 0, embedding: vector } ] }.to_json)
      embedder = build_embedder(instruction: 'Find films')

      result = embedder.check('star wars')

      assert_equal "Instruct: Find films\nQuery: star wars", result.input
      assert_equal 8, result.dimensions
      assert_equal vector.first(Embedder::CHECK_PREVIEW_SIZE), result.preview
      assert_kind_of Integer, result.elapsed_ms
    end

    test 'lets a provider error through' do
      stub_embeddings(status: 401, body: { error: { message: 'bad key' } }.to_json)

      assert_raises(EmbedderAdapters::Error) { build_embedder.check('star wars') }
    end
  end

  describe '#render_input' do
    test 'sends the text as is without an instruction or template' do
      assert_equal 'star wars', build_embedder.render_input('star wars')
    end

    test 'wraps the text in the default template when only an instruction is set' do
      embedder = build_embedder(provider: 'ollama', instruction: 'Find films')

      assert_equal "Instruct: Find films\nQuery: star wars", embedder.render_input('star wars')
    end

    test 'uses a custom template' do
      embedder = build_embedder(provider: 'ollama', input_template: 'query: {query}')

      assert_equal 'query: star wars', embedder.render_input('star wars')
    end
  end

  describe '#fingerprint' do
    test 'changes with settings that change the vectors, not with name or key' do
      embedder = build_embedder
      original = embedder.fingerprint

      embedder.name = 'Renamed'
      embedder.api_key = 'sk-other'

      assert_equal original, embedder.fingerprint

      embedder.model = 'text-embedding-3-large'

      assert_not_equal original, embedder.fingerprint
    end
  end

  describe 'visibility' do
    test 'for_user covers owned and team-shared embedders only' do
      visible = Embedder.for_user(users(:random))

      assert_includes visible, embedders(:openai_small)
      assert_not_includes visible, embedders(:private_ollama)
      assert_includes Embedder.for_user(users(:joey)), embedders(:private_ollama)
    end
  end

  test 'deleting the owner keeps the embedder, unowned' do
    owner = User.create!(email: 'embedder-owner@example.com', password: 'password', name: 'Owner', agreed: true)
    embedder = build_embedder(owner: owner)
    embedder.save!

    owner.destroy!

    assert_nil embedder.reload.owner_id
  end

  test 'deleting an embedder unlinks its cases' do
    acase = cases(:shared_with_team)
    acase.update!(embedder: embedders(:openai_small))

    embedders(:openai_small).destroy!

    assert_nil acase.reload.embedder_id
  end

  test 'encrypts the api key at rest' do
    embedder = build_embedder(api_key: 'sk-secret')
    embedder.save!

    raw = Embedder.connection.select_value("SELECT api_key FROM embedders WHERE id = #{embedder.id}")

    assert_not_includes raw, 'sk-secret'
    assert_equal 'sk-secret', embedder.reload.api_key
  end

  describe 'on a connection' do
    let(:voyage) { connections(:voyage) }
    let(:owner) { users(:doug) }

    def on_connection attributes = {}
      Embedder.new({ name: 'Voyage', model: 'voyage-3.5', owner: owner, connection: voyage }.merge(attributes))
    end

    test 'takes its URL and timeout from the connection, whatever was set on the embedder' do
      embedder = on_connection(provider: 'voyage', service_url: 'https://elsewhere.example', timeout: 99)

      assert_predicate embedder, :valid?
      assert_equal 'https://api.voyageai.com', embedder.service_url
      assert_equal 12, embedder.timeout
    end

    test 'left without a provider, takes the connection\'s' do
      embedder = on_connection

      assert_equal 'voyage', embedder.provider
      assert_predicate embedder, :valid?
      assert_equal 'voyage', embedder.provider_definition.key
    end

    test 'a connection for another provider is refused: a Voyage embedder cannot use an Ollama connection' do
      embedder = on_connection(provider: 'voyage', connection: connections(:shared_ollama))

      assert_not embedder.valid?
      assert_includes embedder.errors[:connection].join, 'is for Ollama, not Voyage AI'
    end

    test 'an Ollama embedder accepts an Ollama connection and no other' do
      assert_predicate on_connection(provider: 'ollama', connection: connections(:shared_ollama), model: 'qwen3-embedding:0.6b'), :valid?

      [ :voyage, :openai ].each do |other|
        embedder = on_connection(provider: 'ollama', connection: connections(other), model: 'm')
        assert_not embedder.valid?, "an Ollama embedder accepted the #{other} connection"
      end
    end

    test 'needs no key of its own, even for a provider that always requires one' do
      assert_predicate on_connection(api_key: nil), :valid?
    end

    test 'sends the key the way the connection says' do
      assert_equal({ 'Authorization' => 'Bearer pa-test-voyage' }, on_connection.request_headers)

      voyage.update!(auth_scheme: 'header', auth_header: 'x-api-key')
      assert_equal({ 'x-api-key' => 'pa-test-voyage' }, on_connection.request_headers)
    end

    test 'an embedder without a connection keeps using its own key' do
      assert_equal({ 'Authorization' => 'Bearer sk-test' }, build_embedder.request_headers)
      assert_empty build_embedder(provider: 'ollama', service_url: 'http://ollama:11434', api_key: nil).request_headers
    end

    test 'masks the connection\'s key, not its own' do
      assert_equal Embedder::MASKED_API_KEY, on_connection(api_key: nil).masked_api_key
      assert_equal '', on_connection(api_key: 'ignored', connection: connections(:private_ollama)).masked_api_key
    end

    test 'the connection must be able to make embeddings' do
      embedder = on_connection(connection: connections(:anthropic))

      assert_not embedder.valid?
      assert_includes embedder.errors[:connection].join, "can't make embeddings"
    end

    test 'the owner must be able to use the connection' do
      embedder = on_connection(owner: users(:joey))

      assert_not embedder.valid?
      assert_includes embedder.errors[:connection].join, "isn't one you can use"
    end

    test 'a team member can own an embedder on a connection shared with their team' do
      assert_predicate on_connection(owner: users(:random)), :valid?
    end

    test 'the fingerprint follows the connection\'s URL, not its key' do
      embedder = on_connection
      before = embedder.fingerprint

      voyage.update!(secret: 'pa-rotated')
      assert_equal before, on_connection.fingerprint

      voyage.update!(base_url: 'https://proxy.example')
      assert_not_equal before, on_connection.fingerprint
    end

    test 'an embedder gives the same fingerprint on a connection as with the same settings of its own' do
      own = build_embedder(provider: 'voyage', service_url: 'https://api.voyageai.com', model: 'voyage-3.5')

      assert_equal own.fingerprint, on_connection.fingerprint
    end

    test 'changing the connection\'s URL re-vectorises the cases of its embedders' do
      embedder = on_connection.tap(&:save!)
      kase = cases(:shared_with_team)
      kase.update!(embedder: embedder)

      assert_enqueued_with(job: VectorizeCaseQueriesJob) do
        voyage.update!(base_url: 'https://proxy.example')
      end
    end

    test 'switching a connection to a service that cannot embed is refused while embedders use it' do
      on_connection.save!

      assert_not voyage.update(service: 'anthropic', auth_scheme: 'header', auth_header: 'x-api-key')
      assert_includes voyage.errors[:service].join, "can't make embeddings"
    end

    test 'switching a connection to another embedding service moves its embedders with it' do
      embedder = on_connection.tap(&:save!)

      voyage.update!(service: 'cohere', base_url: 'https://api.cohere.com')

      assert_equal 'cohere', embedder.reload.provider
    end

    test 'a new embedder needs a connection, or settings of its own' do
      embedder = Embedder.new(name: 'x', provider: 'openai', model: 'm', owner: owner)

      assert_not embedder.valid?
      assert_includes embedder.errors[:connection].join, 'is required'
      assert_predicate build_embedder, :valid?
    end

    test 'an embedder on a connection can move to another, not back to its own settings' do
      embedder = on_connection.tap(&:save!)
      embedder.connection = nil

      assert_not embedder.valid?
      assert_includes embedder.errors[:connection].join, 'can be changed but not removed'
    end

    test 'an embedder from before connections can be saved without one' do
      embedder = embedders(:openai_small)

      assert_nil embedder.connection_id
      assert embedder.update(name: 'Renamed')
    end

    test 'deleting a connection unlinks its embedders instead of deleting them' do
      embedder = on_connection.tap(&:save!)

      voyage.destroy

      assert_nil embedder.reload.connection_id
    end
  end
end
