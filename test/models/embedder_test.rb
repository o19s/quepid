# frozen_string_literal: true

require 'test_helper'

class EmbedderTest < ActiveSupport::TestCase
  def build_embedder attributes = {}
    Embedder.new({
      name:        'Test',
      provider:    'openai',
      service_url: 'https://api.openai.com',
      model:       'text-embedding-3-small',
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
end
