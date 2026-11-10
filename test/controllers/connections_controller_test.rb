# frozen_string_literal: true

require 'test_helper'

class ConnectionsControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:random) }
  let(:connection) { connections(:openai) }
  let(:team) { teams(:shared) }

  setup do
    login_user_for_integration_test user
  end

  def connection_params overrides = {}
    {
      name:        'Voyage',
      provider:    'voyage',
      base_url:    'https://api.voyageai.com',
      auth_scheme: 'bearer',
      secret:      'pa-new',
      timeout:     '30',
    }.merge(overrides)
  end

  test 'index lists the connections the user can use, and marks who owns them' do
    get connections_url

    assert_response :success
    assert_select 'td', text: connection.name, count: 0
    assert_select 'td', text: connections(:instance_elasticsearch).name
    assert_select 'td', text: connections(:private_ollama).name, count: 0
    assert_select 'td .badge', text: 'Instance-wide'
  end

  test 'index has a status column that asks for each connection separately' do
    get connections_url

    assert_select 'th', text: 'Status'
    visible = [ connections(:instance_elasticsearch) ]
    cells = css_select('td[data-controller="connection-status"]')
    assert_equal visible.size, cells.size
    visible.each do |shown|
      assert_select "td[data-connection-status-url-value='#{connection_status_path(shown)}'] button i.bi-plug-fill"
    end
  end

  test 'index shows edit and delete only for connections the user can manage' do
    get connections_url

    assert_select 'a[aria-label=Edit]', count: 0

    owner = users(:doug)
    login_user_for_integration_test owner
    get connections_url

    assert_select 'a[aria-label=Edit]', minimum: 1
  end

  test 'index never shows a secret' do
    get connections_url

    assert_no_match(/sk-test-openai/, response.body)
    assert_no_match(/changeme/, response.body)
  end

  test 'new renders every provider and the presets' do
    get new_connection_url(team_id: team.id)

    assert_response :success
    ConnectionProvider.select_options.map(&:last).each do |key|
      assert_select 'select#connection_provider option[value=?]', key
    end
    form = css_select('[data-controller="connection-form"]').first
    presets = JSON.parse(form['data-connection-form-presets-value'])
    assert_equal 'https://api.openai.com', presets.dig('openai', 'base_url')
    assert_select "input[name='connection[team_ids][]']", count: 0
    assert_select 'input#connection_instance_wide', count: 0
  end

  test 'the form has General, Advanced and Access tabs, with the settings sorted into them' do
    get new_connection_url

    assert_select 'ul#connection-tabs button.nav-link', text: 'General'
    assert_select 'ul#connection-tabs button.nav-link', text: 'Advanced'
    assert_select 'ul#connection-tabs button.nav-link', text: 'Access'
    assert_select '#connection-general [data-connection-form-target=checkButton]'
    %w[connection_base_url connection_auth_scheme connection_secret].each do |field|
      assert_select "#connection-general ##{field}"
    end
    assert_select '#connection-advanced textarea#connection_extra_headers_text'
    assert_select '#connection-advanced input#connection_timeout'
    assert_select '#connection-advanced input#connection_requests_per_minute'
    assert_select '#connection-advanced input#connection_retry_max[placeholder="3"]'
    assert_select '#connection-advanced input#connection_retry_statuses_text[placeholder="429, 529"]'
    assert_select '#connection-advanced input#connection_retry_interval'
    assert_select "#connection-access input[name='connection[team_ids][]']", count: 0
    # Only the name and the provider stay above the tabs.
    assert_select 'input#connection_name'
    assert_select 'select#connection_provider'
    assert_select '#connection-tabs ~ * input#connection_name', count: 0
    assert_select '#connection-advanced input#connection_base_url', count: 0
  end

  test 'an error in an Advanced setting opens that tab' do
    post connections_url, params: { connection: connection_params(timeout: '0') }

    assert_response :unprocessable_content
    assert_select 'button#connection-advanced-tab.active'
    assert_select '#connection-advanced.show.active'
  end

  test 'create retains the owner and ignores forged team grants' do
    assert_difference -> { Connection.count }, 1 do
      post connections_url, params: { connection: connection_params(team_ids: [ team.id.to_s ]) }
    end

    created = Connection.order(:id).last
    assert_redirected_to edit_connection_url(created)
    assert_equal user, created.owner
    assert_equal 'pa-new', created.secret
    assert_not created.instance_wide?
    assert_not Connection.reflect_on_association(:teams)
  end

  test 'create without a name calls the connection after its provider' do
    post connections_url, params: { connection: connection_params(name: '') }

    assert_equal 'Voyage AI Connection', Connection.order(:id).last.name
  end

  test 'the form shows what a blank name will become' do
    get new_connection_url

    assert_select 'input#connection_name[placeholder=?]', 'OpenAI Connection'
  end

  test 'create with errors re-renders the form' do
    assert_no_difference -> { Connection.count } do
      post connections_url, params: { connection: connection_params(name: '', secret: '') }
    end

    assert_response :unprocessable_content
    assert_select '.alert-danger'
  end

  test 'a user cannot make an instance-wide connection' do
    post connections_url, params: { connection: connection_params(instance_wide: '1') }

    assert_equal user, Connection.order(:id).last.owner
    assert_not Connection.order(:id).last.instance_wide?
  end

  test 'an administrator can create an instance-wide connection and remains its owner' do
    login_user_for_integration_test users(:doug)

    post connections_url, params: { connection: connection_params(instance_wide: '1', team_ids: [ team.id.to_s ]) }

    created = Connection.order(:id).last
    assert_predicate created, :instance_wide?
    assert_equal users(:doug), created.owner
  end

  test 'show displays an instance-wide connection without its secret or an edit link' do
    connection.update!(instance_wide: true)
    get connection_url(connection)

    assert_response :success
    assert_select 'dd', text: /secret is saved/
    assert_no_match(/sk-test-openai/, response.body)
    assert_select 'a', text: 'Edit', count: 0
  end

  test 'a connection that is not visible redirects away' do
    get connection_url(connections(:private_ollama))

    assert_redirected_to connections_url
  end

  test 'team membership does not grant access to a private connection' do
    get edit_connection_url(connection)
    assert_redirected_to connections_url

    patch connection_url(connection), params: { connection: { base_url: 'https://evil.example' } }
    assert_redirected_to connections_url
    assert_equal 'https://api.openai.com', connection.reload.base_url

    assert_no_difference -> { Connection.count } do
      delete connection_url(connection)
    end
  end

  test 'the owner updates a connection, and a blank secret keeps the saved one' do
    login_user_for_integration_test users(:doug)

    patch connection_url(connection), params: { connection: { name: 'Renamed', secret: '' } }

    assert_redirected_to edit_connection_url(connection)
    assert_equal 'Renamed', connection.reload.name
    assert_equal 'sk-test-openai', connection.secret
  end

  test 'a typed secret replaces the saved one' do
    login_user_for_integration_test users(:doug)

    patch connection_url(connection), params: { connection: { secret: 'sk-rotated' } }

    assert_equal 'sk-rotated', connection.reload.secret
  end

  test 'update cannot change ownership or publish a private connection through forged parameters' do
    login_user_for_integration_test users(:doug)

    patch connection_url(connection), params: { connection: { name: 'Same', owner_id: user.id, instance_wide: '1', team_ids: [ team.id ] } }

    assert_equal users(:doug), connection.reload.owner
    assert_not connection.instance_wide?
  end

  test 'the owner deletes a connection' do
    login_user_for_integration_test users(:doug)

    assert_difference -> { Connection.count }, -1 do
      delete connection_url(connections(:anthropic))
    end
    assert_redirected_to connections_url
  end

  test 'only an administrator manages an instance-wide connection' do
    communal = connections(:instance_elasticsearch)

    delete connection_url(communal)
    assert Connection.exists?(communal.id)

    login_user_for_integration_test users(:doug)
    delete connection_url(communal)
    assert_not Connection.exists?(communal.id)
  end

  test 'the sidebar links to connections' do
    get connections_url

    assert_select "a[href='#{connections_path}']"
  end

  test 'index and show say what uses a connection' do
    login_user_for_integration_test users(:doug)
    embedders(:openai_small).update!(connection: connections(:openai))

    get connections_url
    assert_select 'td', text: '1 embedder'

    get connection_url(connections(:openai))
    assert_select 'a[href=?]', edit_embedder_path(embedders(:openai_small)), text: embedders(:openai_small).name
  end

  test 'a connection in use cannot be deleted' do
    login_user_for_integration_test users(:doug)
    embedders(:openai_small).update!(connection: connections(:openai))

    assert_no_difference -> { Connection.count } do
      delete connection_url(connections(:openai))
    end

    assert_redirected_to connections_url
    assert_match(/used by 1 embedder/, flash[:alert])
  end

  test 'a connection an AI judge uses cannot be deleted, and lists the judge' do
    login_user_for_integration_test users(:doug)
    judge = AiJudge.create!(name: 'Doug judge', system_prompt: 'Judge it.', owner: users(:doug), connection: connections(:openai))

    get connection_url(connections(:openai))
    assert_select 'a[href=?]', edit_ai_judge_path(judge), text: 'Doug judge'

    assert_no_difference -> { Connection.count } do
      delete connection_url(connections(:openai))
    end
    assert_match(/used by .*1 AI judge/, flash[:alert])
  end
end
