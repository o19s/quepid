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

  test 'should get new' do
    get new_search_endpoint_url
    assert_response :success
  end

  # test 'should create search_endpoint using existing parameters doesnt change anything' do
  #   assert_difference('SearchEndpoint.count', 0) do
  #     post search_endpoints_url,
  #          params: { search_endpoint: {
  #            api_method:     @search_endpoint.api_method,
  #            custom_headers: @search_endpoint.custom_headers,
  #            endpoint_url:   @search_endpoint.endpoint_url,
  #            name:           @search_endpoint.name,
  #            search_engine:  @search_endpoint.search_engine,
  #            team_ids:       [],
  #          } }
  #   end

  #   assert_response :success
  #   assert_empty SearchEndpoint.last.teams
  # end

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
