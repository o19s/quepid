# frozen_string_literal: true

require 'test_helper'

class SearchEndpointsControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:joey) }
  let(:team) { teams(:shared) }

  setup do
    @search_endpoint = search_endpoints(:first_for_case_with_two_tries)

    login_user_for_integration_test user
  end

  test 'should get index' do
    get search_endpoints_url
    assert_response :success
  end

  test 'filters the index by team without raising' do
    @search_endpoint.teams << team unless @search_endpoint.teams.include?(team)

    get search_endpoints_url, params: { team_id: team.id }

    assert_response :success
    assert_includes response.body, @search_endpoint.name
  end

  test 'a team filter hides endpoints that are not shared with that team' do
    @search_endpoint.teams.clear

    get search_endpoints_url, params: { team_id: team.id }

    assert_response :success
    assert_not_includes response.body, @search_endpoint.endpoint_url
  end

  test 'should get new' do
    get new_search_endpoint_url
    assert_response :success
  end

  test 'should create a distinct search_endpoint even when it duplicates an existing one, unshared when team_ids is empty' do
    assert_difference('SearchEndpoint.count', 1) do
      post search_endpoints_url,
           params: { search_endpoint: {
             api_method:     @search_endpoint.api_method,
             custom_headers: @search_endpoint.custom_headers,
             endpoint_url:   @search_endpoint.endpoint_url,
             name:           @search_endpoint.name,
             search_engine:  @search_endpoint.search_engine,
             team_ids:       [],
           } }
    end

    assert_redirected_to search_endpoint_url(SearchEndpoint.last)
    assert_not_equal @search_endpoint.id, SearchEndpoint.last.id
    assert_empty SearchEndpoint.last.teams
  end

  test 'should create search_endpoint' do
    assert_difference('SearchEndpoint.count') do
      post search_endpoints_url,
           params: { search_endpoint: {
             api_method:     @search_endpoint.api_method,
             custom_headers: @search_endpoint.custom_headers,
             endpoint_url:   @search_endpoint.endpoint_url,
             name:           @search_endpoint.name,
             search_engine:  @search_endpoint.search_engine,
             team_ids:       [ team.id ],
           } }
    end

    assert_redirected_to search_endpoint_url(SearchEndpoint.last)
    assert_includes SearchEndpoint.last.teams, team
  end

  test 'cloning keeps the real basic auth secret instead of the masked placeholder' do
    @search_endpoint.update!(basic_auth_credential: 'alice:s3cr3t', owner: user)

    get clone_search_endpoint_url(@search_endpoint)
    assert_response :success
    assert_select 'input[name=clone_of][value=?]', @search_endpoint.id.to_s

    assert_difference('SearchEndpoint.count', 1) do
      post search_endpoints_url,
           params: { clone_of: @search_endpoint.id, search_endpoint: {
             api_method:            @search_endpoint.api_method,
             endpoint_url:          @search_endpoint.endpoint_url,
             name:                  "Clone of #{@search_endpoint.name}",
             search_engine:         @search_endpoint.search_engine,
             basic_auth_credential: @search_endpoint.masked_basic_auth_credential,
             team_ids:              [],
           } }
    end

    assert_equal 'alice:s3cr3t', SearchEndpoint.last.basic_auth_credential
  end

  test 'a typed credential on a clone wins over the source credential' do
    @search_endpoint.update!(basic_auth_credential: 'alice:s3cr3t', owner: user)

    post search_endpoints_url,
         params: { clone_of: @search_endpoint.id, search_endpoint: {
           api_method:            @search_endpoint.api_method,
           endpoint_url:          @search_endpoint.endpoint_url,
           name:                  'Clone with new password',
           search_engine:         @search_endpoint.search_engine,
           basic_auth_credential: 'bob:newpass',
           team_ids:              [],
         } }

    assert_equal 'bob:newpass', SearchEndpoint.last.basic_auth_credential
  end

  test 'should show search_endpoint' do
    # an optimization is suggested that isn't actually needed in real world
    Bullet.enable = false
    get search_endpoint_url(@search_endpoint)
    assert_response :success
    Bullet.enable = true
  end

  test 'should get edit' do
    get edit_search_endpoint_url(@search_endpoint)
    assert_response :success
  end

  test 'should update search_endpoint' do
    patch search_endpoint_url(@search_endpoint),
          params: { search_endpoint: {
            api_method:     @search_endpoint.api_method,
            custom_headers: @search_endpoint.custom_headers,
            endpoint_url:   @search_endpoint.endpoint_url,
            name:           @search_endpoint.name,
            search_engine:  @search_endpoint.search_engine,
            team_ids:       [ team.id ],
          } }
    assert_redirected_to search_endpoint_url(@search_endpoint)
  end

  test 'allow updating a search_endpoint with no teams' do
    patch search_endpoint_url(@search_endpoint),
          params: { search_endpoint: {
            api_method:     @search_endpoint.api_method,
            custom_headers: @search_endpoint.custom_headers,
            endpoint_url:   @search_endpoint.endpoint_url,
            name:           @search_endpoint.name,
            search_engine:  @search_endpoint.search_engine,
            team_ids:       [],
          } }

    assert_redirected_to search_endpoint_url(@search_endpoint)
    # assert_response :success

    assert_not @response.parsed_body.include?('You must select at least one team to share this end point with')
  end

  test 'should destroy search_endpoint' do
    assert_difference('SearchEndpoint.count', -1) do
      delete search_endpoint_url(@search_endpoint)
    end

    assert_redirected_to search_endpoints_url
  end
end
