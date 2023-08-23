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

        test 'returns all scorers owned by user and those shared through teams' do
          get :index

          assert_response :ok

          response.parsed_body

          # expected_owned_response = {
          #   'search_endpoint_id'         => owned_scorer.id,
          #   'communal'          => owned_scorer.communal,
          #   'code'              => owned_scorer.code,
          #   'name'              => owned_scorer.name,
          #   'scale'             => owned_scorer.scale,
          #   'owner_id'          => owned_scorer.owner_id,
          #   'owned'             => true,
          #   'owner_name'        => owned_scorer.owner.name,
          #   'show_scale_labels' => false,
          #   'scale_with_labels' => nil,
          #   'teams'             => [],
          # }

          # teams = shared_scorer.teams.map do |team|
          #   {
          #     'id'       => team.id,
          #     'name'     => team.name,
          #     'owner_id' => team.owner_id,
          #   }
          # end

          # expected_shared_response = {
          #   'scorer_id'         => shared_scorer.id,
          #   'communal'          => owned_scorer.communal,
          #   'code'              => shared_scorer.code,
          #   'name'              => shared_scorer.name,
          #   'scale'             => shared_scorer.scale,
          #   'owner_id'          => shared_scorer.owner_id,
          #   'owned'             => false,
          #   'owner_name'        => shared_scorer.owner.name,
          #   'show_scale_labels' => false,
          #   'scale_with_labels' => nil,
          #   'teams'             => teams,
          # }

          # assert_includes scorers['user_scorers'], expected_owned_response
          # assert_includes scorers['user_scorers'], expected_shared_response

          # ids = scorers['user_scorers'].map { |s| s['scorer_id'] }

          # assert_not_includes ids, communal_scorer.id
        end
      end
    end
  end
end
