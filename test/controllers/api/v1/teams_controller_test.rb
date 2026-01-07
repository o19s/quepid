# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    class TeamsControllerTest < ActionController::TestCase
      let(:user)        { users(:team_finder_user) }
      let(:the_team)    { teams(:owned_team) }
      let(:shared_team) { teams(:shared_team) }
      let(:other_team)  { teams(:valid) }

      before do
        @controller = Api::V1::TeamsController.new

        login_user user
      end

      describe 'Creating a team' do
        let(:jane) { users(:jane) }

        before do
          login_user jane
        end

        test 'requires a team name' do
          post :create, params: { team: { name: '' } }

          assert_response :bad_request

          body = response.parsed_body
          assert_includes body['name'], "can't be blank"
        end

        test 'requires a unique team name' do
          post :create, params: { team: { name: the_team.name } }

          assert_response :bad_request

          body = response.parsed_body
          assert_includes body['name'], 'has already been taken'
        end

        describe 'analytics' do
          test 'posts event' do
            expects_any_ga_event_call

            team_name = 'test team'

            perform_enqueued_jobs do
              post :create, params: { team: { name: team_name } }

              assert_response :ok
            end
          end
        end
      end

      describe 'Fetching a team' do
        test 'returns a not found error if the user does not have access to the team' do
          get :show, params: { team_id: other_team.id }
          assert_response :not_found
        end

        test 'returns team info when user is member of team' do
          get :show, params: { team_id: shared_team.id }
          assert_response :ok

          body = response.parsed_body

          assert_equal body['name'],   shared_team.name
          assert_equal body['id'],     shared_team.id
          # assert_equal body['owned'],  false
        end
      end

      describe 'Deleting an team' do
        test 'return a not found error when user does not have access to the team' do
          delete :destroy, params: { team_id: other_team.id }

          assert_response :not_found
        end

        describe 'analytics' do
          test 'posts event' do
            expects_any_ga_event_call

            perform_enqueued_jobs do
              delete :destroy, params: { team_id: the_team.id }

              assert_response :no_content
            end
          end
        end
      end

      describe 'Updating teams' do
        describe 'when team does not exist' do
          test 'returns not found error' do
            put :update, params: { team_id: 'foo', team: { name: 'foo' } }

            assert_response :not_found
          end
        end

        describe 'when changing the team name' do
          test 'updates name successfully when user owns team' do
            put :update, params: { team_id: the_team.id, team: { name: 'New Name' } }

            assert_response :ok

            the_team.reload
            assert_equal 'New Name', the_team.name
          end

          test 'returns a not found error when user does not have access to the team' do
            put :update, params: { team_id: other_team.id, name: 'New Name' }

            assert_response :not_found
          end
        end

        describe 'analytics' do
          test 'posts event' do
            expects_any_ga_event_call

            perform_enqueued_jobs do
              put :update, params: { team_id: the_team.id, team: { name: 'New Name' } }

              assert_response :ok
            end
          end
        end
      end

      describe 'Listing teams' do
        test 'returns list of teams owned by user' do
          get :index

          assert_response :ok
          body  = response.parsed_body
          teams = body['teams']

          names = teams.map { |team| team['name'] }
          ids = teams.map { |team| team['id'] }

          assert_equal teams.length,        user.teams.length
          assert_includes names,            the_team.name
          assert_includes ids,              the_team.id
        end

        test 'returns list of teams shared by user' do
          get :index

          assert_response :ok
          body  = response.parsed_body
          teams = body['teams']

          names = teams.map { |team| team['name'] }
          ids = teams.map { |team| team['id'] }

          assert_equal    teams.length,     user.teams.all.length
          assert_includes names,            shared_team.name
          assert_includes ids,              shared_team.id

          # sometimes it's the first team, sometimes it's the second team in the array
          # so we have a dynamic lookup
          shared_team = teams.find { |team| 'Team shared with Team Finder User' == team['name'] }

          assert_not_empty shared_team['cases']
          assert_not_empty shared_team['scorers']

          # verify we don't have these fields
          assert_nil shared_team['members']
          assert_nil shared_team['search_endpoints']
        end
      end
    end
  end
end
