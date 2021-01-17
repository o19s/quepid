# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    class TeamCasesControllerTest < ActionController::TestCase
      let(:user)                  { users(:random_1) }
      let(:acase)                 { cases(:random_case) }
      let(:case1)                 { cases(:random_case_1) }
      let(:case2)                 { cases(:random_case_2) }
      let(:shared_case)           { cases(:shared_case) }
      let(:team)                  { teams(:cases_team) }
      let(:other_team)            { teams(:valid) }
      let(:shared_team)           { teams(:another_shared_team) }

      before do
        @controller = Api::V1::TeamCasesController.new

        login_user user
      end

      describe 'Adds new cases to team' do
        test 'adds a new case successfully' do
          assert_difference 'team.cases.count' do
            post :create, params: { team_id: team.id, id: acase.id }

            assert_response :ok
          end
        end

        test 'does not add an existing case' do
          assert_difference 'team.cases.count', 0 do
            post :create, params: { team_id: team.id, id: case1.id }

            assert_response :ok
          end
        end

        test 'returns a not found error when the new case does not exist' do
          post :create, params: { team_id: team.id, id: 'foo' }

          assert_response :not_found
        end

        test "returns a not found error when the team can't be access by the user" do
          post :create, params: { team_id: other_team.id }

          assert_response :not_found
        end

        test 'adds case successfully when the user is a member of the team' do
          assert_difference 'shared_team.cases.count' do
            post :create, params: { team_id: shared_team.id, id: acase.id }

            assert_response :ok
          end
        end

        describe 'analytics' do
          test 'posts event' do
            expects_any_ga_event_call

            perform_enqueued_jobs do
              post :create, params: { team_id: shared_team.id, id: acase.id }

              assert_response :ok
            end
          end
        end
      end

      describe 'Removes a case from team' do
        test 'deletes existing case successfully' do
          assert_difference 'team.cases.count', -1 do
            delete :destroy, params: { team_id: team.id, id: case1.id }

            assert_response :no_content
          end
        end

        test "returns a not found error when the team can't be access by the user" do
          delete :destroy, params: { team_id: other_team.id, id: 'foo' }

          assert_response :not_found
        end

        test 'deletes existing case successfully when the user is a member of the team' do
          assert_difference 'shared_team.cases.count', -1 do
            delete :destroy, params: { team_id: shared_team.id, id: shared_case.id }

            assert_response :no_content
          end
        end

        test 'does nothing when the case does not exist' do
          delete :destroy, params: { team_id: team.id, id: 'foo' }

          assert_response :no_content
        end
      end

      describe 'Lists all team cases' do
        test "returns a list of all the team's cases" do
          get :index, params: { team_id: team.id }

          assert_response :ok

          cases = JSON.parse(response.body)['cases']

          assert_instance_of  Array, cases
          assert_equal        team.cases.count, cases.length

          ids = cases.map { |c| c['caseNo'] }

          assert_includes ids, case1.id
          assert_includes ids, case2.id
        end
        test "returns a list of all the team's cases the user is a member of" do
          get :index, params: { team_id: shared_team.id }

          assert_response :ok

          cases = JSON.parse(response.body)['cases']

          assert_instance_of  Array, cases
          assert_equal        shared_team.cases.count, cases.length
        end
      end
    end
  end
end
