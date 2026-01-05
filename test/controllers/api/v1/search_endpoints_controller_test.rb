# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    class SearchEndpointsControllerTest < ActionController::TestCase
      let(:user) { users(:doug) }

      before do
        @controller = Api::V1::SearchEndpointsController.new

        login_user user
      end

      describe 'Fetches search endpoint' do
        let(:one) { search_endpoints(:one) }
        let(:for_shared_team_case) { search_endpoints(:for_shared_team_case) }

        test 'returns a not found error if the search endpoint is neither owned by the user or shared with the user' do
          get :show, params: { id: 'foo' } # for when it doesn't exist

          assert_response :not_found
        end

        test 'returns search endpoint accessible to Doug via previous case use.' do
          get :show, params: { id: one.id }

          assert_response :ok

          search_endpoint_response = response.parsed_body

          assert_equal one.id,         search_endpoint_response['search_endpoint_id']
          assert_equal one.name,       search_endpoint_response['name']
          assert_equal one.endpoint_url, search_endpoint_response['endpoint_url']
          assert_equal one.search_engine,           search_endpoint_response['search_engine']
          assert_equal one.api_method,              search_endpoint_response['api_method']
        end

        test 'returns search endpoint shared with Doug via membership in team' do
          get :show, params: { id: for_shared_team_case.id }

          assert_response :ok

          search_endpoint_response = response.parsed_body

          assert_equal for_shared_team_case.id,         search_endpoint_response['search_endpoint_id']
          assert_equal for_shared_team_case.name,       search_endpoint_response['name']
          assert_equal for_shared_team_case.endpoint_url, search_endpoint_response['endpoint_url']
          assert_equal for_shared_team_case.search_engine,           search_endpoint_response['search_engine']
          assert_equal for_shared_team_case.api_method,              search_endpoint_response['api_method']
        end
      end

      describe 'Fetches search endpoints' do
        let(:for_shared_team_case)     { search_endpoints(:for_shared_team_case) }
        let(:for_case_queries_case)    { search_endpoints(:for_case_queries_case) }

        test 'returns all search endpoints owned by user and those shared through teams' do
          get :index

          assert_response :ok

          response.parsed_body['search_endpoints']

          ids = response.parsed_body['search_endpoints'].map { |s| s['search_endpoint_id'] }

          assert_includes ids, for_shared_team_case.id
          assert_includes ids, for_case_queries_case.id
        end
      end

      describe 'Updating search endpoints' do
        let(:one) { search_endpoints(:one) }

        describe 'when search endpoint does not exist' do
          test 'returns not found error' do
            patch :update, params: { id: 'foo', name: 'foo' }
            assert_response :not_found
          end
        end

        describe 'when changing the name' do
          test 'updates name successfully using PATCH verb' do
            patch :update, params: { id: one.id, search_endpoint: { name: 'New Name' } }
            # assert_response :ok

            one.reload
            assert_equal 'New Name', one.name
          end

          test 'updates name successfully using PUT verb' do
            put :update, params: { id: one.id, search_endpoint: { name: 'New Name' } }
            # assert_response :ok

            one.reload
            assert_equal 'New Name', one.name
          end
        end
      end
    end
  end
end
