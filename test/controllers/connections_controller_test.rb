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
      service:     'voyage',
      base_url:    'https://api.voyageai.com',
      auth_scheme: 'bearer',
      secret:      'pa-new',
      timeout:     '30',
    }.merge(overrides)
  end

  test 'index lists the connections the user can use, and marks who owns them' do
    get connections_url

    assert_response :success
    assert_select 'td', text: connection.name
    assert_select 'td', text: connections(:instance_elasticsearch).name
    assert_select 'td', text: connections(:private_ollama).name, count: 0
    assert_select 'td .badge', text: 'Everyone'
  end

  test 'index has a status column that asks for each connection separately' do
    get connections_url

    assert_select 'th', text: 'Status'
    visible = [ connection, connections(:voyage), connections(:shared_ollama), connections(:instance_elasticsearch) ]
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

  test 'new renders every service and the presets' do
    get new_connection_url(team_id: team.id)

    assert_response :success
    ConnectionService.select_options.map(&:last).each do |key|
      assert_select 'select#connection_service option[value=?]', key
    end
    form = css_select('[data-controller="connection-form"]').first
    presets = JSON.parse(form['data-connection-form-presets-value'])
    assert_equal 'https://api.openai.com', presets.dig('openai', 'base_url')
    assert_select "input[name='connection[team_ids][]'][value='#{team.id}'][checked]"
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
    assert_select "#connection-access input[name='connection[team_ids][]']"
    # Only the name and the service stay above the tabs.
    assert_select 'input#connection_name'
    assert_select 'select#connection_service'
    assert_select '#connection-tabs ~ * input#connection_name', count: 0
    assert_select '#connection-advanced input#connection_base_url', count: 0
  end

  test 'an error in an Advanced setting opens that tab' do
    post connections_url, params: { connection: connection_params(timeout: '0') }

    assert_response :unprocessable_content
    assert_select 'button#connection-advanced-tab.active'
    assert_select '#connection-advanced.show.active'
  end

  test 'create saves a connection owned by the user and shares it with the chosen teams' do
    assert_difference -> { Connection.count }, 1 do
      post connections_url, params: { connection: connection_params(team_ids: [ team.id.to_s ]) }
    end

    created = Connection.order(:id).last
    assert_redirected_to edit_connection_url(created)
    assert_equal user, created.owner
    assert_equal 'pa-new', created.secret
    assert_equal [ team ], created.teams.to_a
  end

  test 'create without a name calls the connection after its service' do
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
  end

  test 'an administrator can make an instance-wide connection, which takes no teams' do
    login_user_for_integration_test users(:doug)

    post connections_url, params: { connection: connection_params(instance_wide: '1', team_ids: [ team.id.to_s ]) }

    created = Connection.order(:id).last
    assert_predicate created, :instance_wide?
    assert_empty created.teams
  end

  test 'show displays a connection shared with the user, without its secret or an edit link' do
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

  test 'a team member cannot edit, update or delete a shared connection' do
    get edit_connection_url(connection)
    assert_redirected_to connection_url(connection)

    patch connection_url(connection), params: { connection: { base_url: 'https://evil.example' } }
    assert_redirected_to connection_url(connection)
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

  test 'saving does not unshare a team the user is not a member of' do
    login_user_for_integration_test users(:doug)
    outsider = Team.create!(name: 'Outsiders')
    connection.teams << outsider

    patch connection_url(connection), params: { connection: { name: 'Same', team_ids: [] } }

    assert_includes connection.reload.teams, outsider
  end

  test 'the owner deletes a connection' do
    login_user_for_integration_test users(:doug)

    assert_difference -> { Connection.count }, -1 do
      delete connection_url(connection)
    end
    assert_redirected_to connections_url
  end

  test 'only an administrator manages an instance-wide connection' do
    instance_wide = connections(:instance_elasticsearch)

    delete connection_url(instance_wide)
    assert Connection.exists?(instance_wide.id)

    login_user_for_integration_test users(:doug)
    delete connection_url(instance_wide)
    assert_not Connection.exists?(instance_wide.id)
  end

  test 'the sidebar links to connections' do
    get connections_url

    assert_select "a[href='#{connections_path}']"
  end

  test 'index and show say what uses a connection' do
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
end
