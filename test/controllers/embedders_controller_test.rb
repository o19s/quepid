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

  test 'index is marked beta and explains what an embedder is' do
    get embedders_url

    assert_response :success
    assert_select 'h1 sup', text: 'β'
    assert_select '.alert-info', text: /turns query text into a vector embedding/
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

  test 'a clone of an embedder on a connection keeps the connection' do
    embedder.update!(connection: connections(:openai))

    get clone_embedder_url(embedder)
    assert_response :success
    assert_select "select#embedder_connection_id option[selected][value='#{connections(:openai).id}']"

    post embedders_url, params: { embedder: embedder_form_params(name: 'Clone', provider: 'openai', model: 'text-embedding-3-small',
                                                                 connection_id: connections(:openai).id).except(:service_url, :api_key) }

    assert_equal connections(:openai), Embedder.last.connection
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

  describe 'with a connection' do
    let(:voyage) { connections(:voyage) }
    let(:openai_connection) { connections(:openai) }

    def connection_embedder_params overrides = {}
      { name: 'On Voyage', provider: 'voyage', service_url: 'https://ignored.example', model: 'voyage-3.5',
        connection_id: voyage.id, timeout: '30' }.merge(overrides)
    end

    test 'the connection field comes right below the provider' do
      get new_embedder_url

      labels = css_select('form label').map { |label| label['for'] }
      assert_equal 'embedder_provider', labels[labels.index('embedder_connection_id') - 1]
    end

    test 'a new embedder, which starts on OpenAI, lists only the OpenAI connections' do
      get new_embedder_url

      assert_select 'select#embedder_connection_id option[value=?]', connections(:openai).id.to_s, text: 'OpenAI'
      [ :voyage, :shared_ollama, :anthropic, :private_ollama, :instance_elasticsearch ].each do |other|
        assert_select 'select#embedder_connection_id option[value=?]:not([disabled])', connections(other).id.to_s, count: 0
      end
      option = css_select("select#embedder_connection_id option[value='#{connections(:openai).id}']").first
      assert_equal 'openai', option['data-service']
      assert_equal 'https://api.openai.com', option['data-url']
    end

    test 'the other providers\' connections are still in the list, disabled, so changing the provider can enable them' do
      get new_embedder_url

      option = css_select("select#embedder_connection_id option[value='#{connections(:shared_ollama).id}']").first
      assert option.key?('disabled')
      assert_equal 'ollama', option['data-service']
    end

    test 'an Ollama embedder lists only the Ollama connections' do
      ollama = Embedder.create!(name: 'Ollama', provider: 'ollama', service_url: 'http://ollama:11434',
                                model: 'qwen3-embedding:0.6b', owner: user)

      get edit_embedder_url(ollama)

      assert_select 'select#embedder_connection_id option[value=?]', connections(:shared_ollama).id.to_s, text: 'Shared Ollama'
      [ :openai, :voyage, :anthropic, :private_ollama ].each do |other|
        assert_select 'select#embedder_connection_id option[value=?]:not([disabled])', connections(other).id.to_s, count: 0
      end
    end

    test 'a Voyage embedder lists only the Voyage connections' do
      voyage_embedder = Embedder.create!(name: 'Voyage', provider: 'voyage', service_url: 'https://api.voyageai.com',
                                         model: 'voyage-3.5', api_key: 'pa-x', owner: user)

      get edit_embedder_url(voyage_embedder)

      assert_select 'select#embedder_connection_id option[value=?]', voyage.id.to_s
      assert_select 'select#embedder_connection_id option[value=?]:not([disabled])', connections(:shared_ollama).id.to_s, count: 0
      assert_select 'select#embedder_connection_id option[value=?]:not([disabled])', connections(:openai).id.to_s, count: 0
    end

    test 'create refuses a connection for another provider' do
      assert_no_difference -> { Embedder.count } do
        post embedders_url, params: { embedder: connection_embedder_params(provider: 'ollama', connection_id: voyage.id) }
      end

      assert_response :unprocessable_content
      assert_select '.alert-danger', text: /is for Voyage AI, not Ollama/
    end

    test 'create saves an embedder on a connection that takes its provider and URL from it' do
      assert_difference -> { Embedder.count }, 1 do
        post embedders_url, params: { embedder: connection_embedder_params }
      end

      created = Embedder.order(:id).last
      assert_redirected_to edit_embedder_url(created)
      assert_equal voyage, created.connection
      assert_equal 'voyage', created.provider
      assert_equal 'https://api.voyageai.com', created.service_url
    end

    test 'create refuses a connection the user cannot use' do
      assert_no_difference -> { Embedder.count } do
        post embedders_url, params: { embedder: connection_embedder_params(connection_id: connections(:private_ollama).id) }
      end

      assert_response :unprocessable_content
      assert_select '.alert-danger', text: /isn't one you can use/
    end

    test 'create refuses a connection that cannot make embeddings' do
      assert_no_difference -> { Embedder.count } do
        post embedders_url, params: { embedder: connection_embedder_params(connection_id: connections(:anthropic).id) }
      end

      assert_response :unprocessable_content
    end

    test 'update moves an embedder onto a connection, but not back to settings of its own' do
      # The form always posts the team boxes; without them saving unshares the embedder from the user's teams.
      patch embedder_url(embedder), params: { embedder: { connection_id: openai_connection.id, team_ids: [ team.id.to_s ] } }
      assert_equal openai_connection, embedder.reload.connection

      patch embedder_url(embedder), params: { embedder: { connection_id: '', team_ids: [ team.id.to_s ] } }
      assert_response :unprocessable_content
      assert_select '.alert-danger', text: /can be changed but not removed/
      assert_equal openai_connection, embedder.reload.connection
    end

    test 'an embedder from before connections keeps working and can be saved without one' do
      assert_nil embedder.connection_id
      assert_equal 'https://api.openai.com', embedder.service_url

      patch embedder_url(embedder), params: { embedder: { name: 'Renamed', team_ids: [ team.id.to_s ] } }

      assert_equal 'Renamed', embedder.reload.name
      assert_nil embedder.connection_id
      assert_equal 'sk-test-openai', embedder.api_key
    end

    test 'the form says an old embedder still uses its own URL and key, and has nothing to check yet' do
      get edit_embedder_url(embedder)

      assert_select '.alert-warning[role=alert]', text: /old, deprecated configuration and needs to be migrated to a connection/
      assert_select '.alert-warning[role=alert] a[data-bs-toggle=collapse]', text: 'Details'
      assert_select '.alert-warning .collapse#embedder-legacy-details', text: /choose a connection above/
      assert_select '#embedder-legacy-details dd', text: 'https://api.openai.com'
      assert_select '#embedder-legacy-details dd', text: /only the owner can see it/
      assert_select '#embedder-legacy-details', text: /sk-test-openai/, count: 0
      assert_select 'button[data-embedder-form-target=checkButton][disabled]'
      assert_select '[data-embedder-form-target=checkHint]:not([hidden])', text: /add a connection/
    end

    test 'the owner of an old embedder sees its key in the details, to copy into a connection' do
      embedder.update_column :owner_id, user.id

      get edit_embedder_url(embedder)

      assert_select '#embedder-legacy-details dd code', text: 'sk-test-openai'
    end

    test 'the form has no URL, key or timeout fields: they come from the connection' do
      get new_embedder_url

      %w[service_url api_key timeout].each do |field|
        assert_select "[name='embedder[#{field}]']", count: 0
      end
      assert_select 'select#embedder_connection_id'
    end

    test 'a new embedder needs a connection' do
      assert_no_difference -> { Embedder.count } do
        post embedders_url, params: { embedder: { name: 'No connection', provider: 'openai', model: 'text-embedding-3-small' } }
      end

      assert_response :unprocessable_content
      assert_select '.alert-danger', text: /Connection is required/
    end

    test 'the Check connection button is enabled on an embedder that has a connection' do
      embedder.update!(connection: openai_connection)

      get edit_embedder_url(embedder)

      assert_select 'button[data-embedder-form-target=checkButton]:not([disabled])'
      assert_select '[data-embedder-form-target=checkHint][hidden]'
    end

    test 'the form has Model, Instructions and Access tabs, with the settings sorted into them' do
      get new_embedder_url

      assert_select 'ul#embedder-tabs button.nav-link', text: 'Model'
      assert_select 'ul#embedder-tabs button.nav-link', text: 'Instructions'
      assert_select 'ul#embedder-tabs button.nav-link', text: 'Access'
      assert_select '#embedder-model input#embedder_model'
      assert_select '#embedder-model select#embedder_truncation'
      assert_select '#embedder-model input#embedder_dimensions'
      assert_select '#embedder-instructions textarea#embedder_instruction'
      assert_select '#embedder-instructions textarea#embedder_input_template'
      assert_select "#embedder-access input[name='embedder[team_ids][]']"
      # The name, provider and connection stay above the tabs; the check stays below them.
      assert_select 'input#embedder_name'
      assert_select 'select#embedder_provider'
      assert_select 'select#embedder_connection_id'
      assert_select '#embedder-tabs ~ * input#embedder_name', count: 0
      assert_select '.tab-content input#embedder_name', count: 0
    end

    test 'an error in the instructions opens that tab' do
      post embedders_url, params: { embedder: connection_embedder_params(provider: 'ollama', connection_id: connections(:shared_ollama).id, model: 'qwen3-embedding:0.6b', input_template: 'no placeholder') }

      assert_response :unprocessable_content
      assert_select 'button#embedder-instructions-tab.active'
      assert_select '#embedder-instructions.show.active'
    end

    test 'a team member keeps an embedder on a connection they can no longer use when they only rename it' do
      embedder.update!(connection: openai_connection)
      openai_connection.teams.clear

      patch embedder_url(embedder), params: { embedder: { name: 'Renamed', connection_id: openai_connection.id } }

      assert_equal 'Renamed', embedder.reload.name
      assert_equal openai_connection, embedder.connection
    end

    test 'index shows which connection an embedder uses' do
      embedder.update!(connection: openai_connection)

      get embedders_url

      assert_select 'td a[href=?]', connection_path(openai_connection), text: 'OpenAI'
    end
  end
end
