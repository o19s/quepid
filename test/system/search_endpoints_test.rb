# frozen_string_literal: true

require 'controllers/application_system_test_case'

# If we start using these, we should enable
# Capybara/ClickLinkOrButtonStyle
class SearchEndpointsTest < ApplicationSystemTestCase
  setup do
    @search_endpoint = search_endpoints(:one)
  end

  test 'visiting the index' do
    visit search_endpoints_url
    assert_selector 'h1', text: 'Search endpoints'
  end

  test 'should create search endpoint' do
    visit search_endpoints_url
    click_on 'New search endpoint'

    fill_in 'Api method', with: @search_endpoint.api_method
    fill_in 'Custom headers', with: @search_endpoint.custom_headers
    fill_in 'Endpoint url', with: @search_endpoint.endpoint_url
    fill_in 'Name', with: @search_endpoint.name
    fill_in 'Search engine', with: @search_endpoint.search_engine
    click_on 'Create Search endpoint'

    assert_text 'Search endpoint was successfully created'
    click_on 'Back'
  end

  test 'should update Search endpoint' do
    visit search_endpoint_url(@search_endpoint)
    click_on 'Edit this search endpoint', match: :first

    fill_in 'Api method', with: @search_endpoint.api_method
    fill_in 'Custom headers', with: @search_endpoint.custom_headers
    fill_in 'Endpoint url', with: @search_endpoint.endpoint_url
    fill_in 'Name', with: @search_endpoint.name
    fill_in 'Search engine', with: @search_endpoint.search_engine
    click_on 'Update Search endpoint'

    assert_text 'Search endpoint was successfully updated'
    click_on 'Back'
  end

  test 'should destroy Search endpoint' do
    visit search_endpoint_url(@search_endpoint)
    click_on 'Destroy this search endpoint', match: :first

    assert_text 'Search endpoint was successfully destroyed'
  end
end
