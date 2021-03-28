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

        test "successfully creates a team and adds it to the user's owned teams list" do
          count     = jane.owned_teams.count
          team_name = 'test team'

          post :create, params: { team: { name: team_name } }

          assert_response :ok

          body = JSON.parse(response.body)
          assert body['name'] == team_name

          assert_equal jane.owned_teams.count,      count + 1
          assert_equal jane.owned_teams.first.name, team_name
        end

        test 'requires a team name' do
          post :create, params: { team: { name: '' } }

          assert_response :bad_request

          body = JSON.parse(response.body)
          assert_includes body['name'], "can't be blank"
        end

        test 'requires a unique team name' do
          post :create, params: { team: { name: the_team.name } }

          assert_response :bad_request

          body = JSON.parse(response.body)
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

        test 'returns team info when user owns team' do
          get :show, params: { team_id: the_team.id }
          assert_response :ok

          body = JSON.parse(response.body)

          assert_equal body['name'],   the_team.name
          assert_equal body['id'],     the_team.id
          assert_equal body['owned'],  true
        end

        test 'returns team info user is member of team' do
          get :show, params: { team_id: shared_team.id }
          assert_response :ok

          body = JSON.parse(response.body)

          assert_equal body['name'],   shared_team.name
          assert_equal body['id'],     shared_team.id
          assert_equal body['owned'],  false
        end
      end

      describe 'Deleting an team' do
        test 'return a forbidden error when user does not own the team' do
          delete :destroy, params: { team_id: shared_team.id }

          assert_response :forbidden
        end
        test 'return a not found error when user does not have access to the team' do
          delete :destroy, params: { team_id: other_team.id }

          assert_response :not_found
        end

        test 'successfully deletes team if user owns the team' do
          assert_difference 'user.owned_teams.count', -1 do
            delete :destroy, params: { team_id: the_team.id }

            assert_response :no_content
          end
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
            assert_equal the_team.name, 'New Name'
          end

          test 'returns a forbidden error when user does not own the team' do
            put :update, params: { team_id: shared_team.id, team: { name: 'New Name' } }

            assert_response :forbidden
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
          body  = JSON.parse(response.body)
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
          body  = JSON.parse(response.body)
          teams = body['teams']

          names = teams.map { |team| team['name'] }
          ids = teams.map { |team| team['id'] }

          assert_equal    teams.length,     user.teams.all.length
          assert_includes names,            shared_team.name
          assert_includes ids,              shared_team.id
        end

        test 'returns list of teams and loads case data' do
          get :index, params: { load_cases: true }

          assert_response :ok

          body  = JSON.parse(response.body)
          teams = body['teams']

          # sometimes it's the first team, sometimes it's the second team in the array.
          assert_not_empty(teams.find { |team| 'Team shared with Team Finder User' == team['name'] }['cases'])
          assert_equal 1, teams.find { |team|
                            'Team shared with Team Finder User' == team['name']
                          } ['cases'][0]['last_try_number']
        end
      end
    end
  end
end
