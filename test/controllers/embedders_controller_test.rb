# frozen_string_literal: true

require 'test_helper'

class EmbeddersControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:random) }
  let(:embedder) { embedders(:openai_small) }
  let(:team) { teams(:shared) }

  setup do
    login_user_for_integration_test user
  end

  def embedder_form_params overrides = {}
    {
      name:        'Voyage',
      provider:    'voyage',
      service_url: 'https://api.voyageai.com',
      model:       'voyage-3.5',
      api_key:     'pa-new',
      truncation:  'native',
      dimensions:  '1024',
      timeout:     '30',
    }.merge(overrides)
  end

  test 'index lists embedders the user can see' do
    get embedders_url

    assert_response :success
    assert_select 'td', text: embedder.name
    assert_select 'td', text: embedders(:private_ollama).name, count: 0
  end

  test 'new renders every provider and the presets' do
    get new_embedder_url(team_id: team.id)

    assert_response :success
    EmbedderProvider.select_options.map(&:last).each do |key|
      assert_select 'select#embedder_provider option[value=?]', key
    end
    form = css_select('[data-controller="embedder-form"]').first
    assert_equal EmbedderProvider.presets.deep_stringify_keys, JSON.parse(form['data-embedder-form-presets-value'])
    assert_select "input[type=checkbox][value='#{team.id}'][checked]"
  end

  test 'create saves an embedder owned by the user and shares it' do
    assert_difference 'Embedder.count' do
      post embedders_url, params: { embedder: embedder_form_params(team_ids: [ team.id.to_s ]) }
    end

    created = Embedder.last
    assert_redirected_to edit_embedder_url(created)
    assert_equal user, created.owner
    assert_equal 'pa-new', created.api_key
    assert_equal [ team ], created.teams.to_a
  end

  test 'create re-renders with errors' do
    assert_no_difference 'Embedder.count' do
      post embedders_url, params: { embedder: embedder_form_params(dimensions: '300') }
    end

    assert_response :unprocessable_content
  end

  test 'the form never renders the saved key' do
    get edit_embedder_url(embedder)

    assert_response :success
    assert_no_match 'sk-test-openai', response.body
  end

  test 'update with a blank key keeps the saved key' do
    patch embedder_url(embedder), params: { embedder: { name: 'Renamed', api_key: '', team_ids: [ team.id.to_s ] } }

    assert_redirected_to edit_embedder_url(embedder)
    embedder.reload
    assert_equal 'Renamed', embedder.name
    assert_equal 'sk-test-openai', embedder.api_key
  end

  test 'update replaces the key when a new one is typed' do
    patch embedder_url(embedder), params: { embedder: { api_key: 'sk-rotated' } }

    assert_equal 'sk-rotated', embedder.reload.api_key
  end

  test 'a clone without a typed key keeps the source key' do
    get clone_embedder_url(embedder)
    assert_response :success
    assert_select 'input[name=clone_of][value=?]', embedder.id.to_s

    post embedders_url, params: { clone_of: embedder.id,
                                  embedder: embedder_form_params(provider: 'openai', service_url: 'https://api.openai.com',
                                                                 model: 'text-embedding-3-small', api_key: '') }

    assert_equal 'sk-test-openai', Embedder.last.api_key
  end

  test 'cannot see an embedder that is not shared with the user' do
    get edit_embedder_url(embedders(:private_ollama))

    assert_redirected_to embedders_url
  end

  test 'destroy removes it' do
    assert_difference 'Embedder.count', -1 do
      delete embedder_url(embedder)
    end

    assert_redirected_to embedders_url
  end
end
