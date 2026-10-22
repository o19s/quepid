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

        { 'alice:******' => 'alice:secret', 'bob:newpass' => 'bob:newpass', '' => '', nil => nil }.each do |submitted, expected|
          test "API update preserves credential policy for #{submitted.inspect}" do
            one.update!(basic_auth_credential: 'alice:secret', proxy_requests: true, api_method: 'GET')
            patch :update, params: { id: one.id, search_endpoint: { basic_auth_credential: submitted } }

            assert_response :no_content
            if expected.nil?
              assert_nil one.reload.basic_auth_credential
            else
              assert_equal expected, one.reload.basic_auth_credential
            end
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

      describe 'Filtering and archiving' do
        let(:endpoint) { search_endpoints(:one) }
        let(:team)     { teams(:shared) }

        def listed_ids params = {}
          get :index, params: params

          assert_response :ok
          response.parsed_body['search_endpoints'].pluck('search_endpoint_id')
        end

        test 'lists only the endpoints shared with the requested team' do
          ids = listed_ids(team_id: team.id)

          assert_includes ids, endpoint.id
          assert_empty ids - team.search_endpoints.pluck(:id)
        end

        test 'lists only the endpoints of the teams a case is shared with' do
          ids = listed_ids(case_id: cases(:shared_with_team).id)

          assert_includes ids, endpoint.id
          assert_empty ids - team.search_endpoints.pluck(:id)
        end

        test 'archiving takes the endpoint over and moves it to the archived list' do
          patch :update, params: { id: endpoint.id, archived: true, search_endpoint: { name: endpoint.name } }

          assert_response :no_content
          endpoint.reload
          assert_predicate endpoint, :archived?
          assert_equal user, endpoint.owner
          assert_not_includes listed_ids, endpoint.id
          assert_includes listed_ids(archived: true), endpoint.id
        end

        test 'does not rename an endpoint while archiving it' do
          original = endpoint.name

          patch :update, params: { id: endpoint.id, archived: true, search_endpoint: { name: 'ignored' } }

          assert_equal original, endpoint.reload.name
        end
      end

      describe 'Rejecting invalid endpoints' do
        test 'create reports the validation errors and saves nothing' do
          assert_no_difference 'SearchEndpoint.count' do
            post :create, params: { search_endpoint: { name: 'No url', search_engine: 'solr', api_method: 'GET' } }
          end

          assert_response :bad_request
          assert response.parsed_body.key?('endpoint_url')
        end

        test 'update reports the validation errors and keeps the old values' do
          endpoint = search_endpoints(:one)
          original = endpoint.endpoint_url

          patch :update, params: { id: endpoint.id, search_endpoint: { endpoint_url: '' } }

          assert_response :bad_request
          assert response.parsed_body.key?('endpoint_url')
          assert_equal original, endpoint.reload.endpoint_url
        end
      end
    end
  end
end
