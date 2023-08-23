# frozen_string_literal: true

require 'test_helper'

class SearchEndpointsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @search_endpoint = search_endpoints(:one)
  end

  test 'should get index' do
    get search_endpoints_url
    assert_response :success
  end

  test 'should get new' do
    get new_search_endpoint_url
    assert_response :success
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
           } }
    end

    assert_redirected_to search_endpoint_url(SearchEndpoint.last)
  end

  test 'should show search_endpoint' do
    get search_endpoint_url(@search_endpoint)
    assert_response :success
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
          } }
    assert_redirected_to search_endpoint_url(@search_endpoint)
  end

  test 'should destroy search_endpoint' do
    assert_difference('SearchEndpoint.count', -1) do
      delete search_endpoint_url(@search_endpoint)
    end

    assert_redirected_to search_endpoints_url
  end
end
