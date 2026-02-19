# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    class TeamScorersControllerTest < ActionController::TestCase
      let(:user)                  { users(:random) }
      let(:scorer)                { scorers(:random_scorer) }
      let(:scorer1)               { scorers(:random_scorer_1) }
      let(:scorer2)               { scorers(:random_scorer_2) }
      let(:shared_scorer)         { scorers(:shared_scorer) }
      let(:team)                  { teams(:scorers_team) }
      let(:other_team)            { teams(:owned_team) }
      let(:shared_team)           { teams(:shared) }

      before do
        @controller = Api::V1::TeamScorersController.new

        login_user user
      end

      describe 'Adds new scorers to team' do
        test 'adds a new scorer successfully' do
          assert_difference 'team.scorers.count' do
            post :create, params: { team_id: team.id, id: scorer.id }

            assert_response :ok
          end
        end

        test 'does not add an existing scorer' do
          assert_difference 'team.scorers.count', 0 do
            post :create, params: { team_id: team.id, id: scorer1.id }

            assert_response :ok
          end
        end

        test 'returns a not found error when the new scorer does not exist' do
          post :create, params: { team_id: team.id, id: 'foo' }

          assert_response :not_found
        end

        test "returns a not found error when the team can't be access by the user" do
          post :create, params: { team_id: other_team.id }

          assert_response :not_found
        end

        test 'adds scorer successfully when the user is a member of the team' do
          assert_difference 'shared_team.scorers.count' do
            post :create, params: { team_id: shared_team.id, id: scorer.id }

            assert_response :ok
          end
        end

        describe 'analytics' do
          test 'posts event' do
            expects_any_ga_event_call

            perform_enqueued_jobs do
              post :create, params: { team_id: team.id, id: scorer.id }

              assert_response :ok
            end
          end
        end
      end

      describe 'Removes a scorer from team' do
        test 'deletes existing scorer successfully' do
          assert_difference 'team.scorers.count', -1 do
            delete :destroy, params: { team_id: team.id, id: scorer1.id }

            assert_response :no_content
          end
        end

        test "returns a not found error when the team can't be access by the user" do
          delete :destroy, params: { team_id: other_team.id, id: 'foo' }

          assert_response :not_found
        end

        test 'deletes existing scorer successfully when the user is a member of the team' do
          assert_difference 'shared_team.scorers.count', -1 do
            delete :destroy, params: { team_id: shared_team.id, id: shared_scorer.id }

            assert_response :no_content
          end
        end

        test 'does nothing when the scorer does not exist' do
          delete :destroy, params: { team_id: team.id, id: 'foo' }

          assert_response :no_content
        end
      end

      describe 'Lists all team scorers' do
        test "returns a list of all the team's scorers" do
          get :index, params: { team_id: team.id }

          assert_response :ok

          scorers = response.parsed_body['scorers']

          assert_instance_of  Array, scorers
          assert_equal        team.scorers.count, scorers.length

          ids = scorers.map { |scorer| scorer['scorer_id'] }

          assert_includes ids, scorer1.id
          assert_includes ids, scorer2.id
        end
        test "returns a list of all the team's scorers the user is a member of" do
          get :index, params: { team_id: shared_team.id }

          assert_response :ok

          scorers = response.parsed_body['scorers']

          assert_instance_of  Array, scorers
          assert_equal        shared_team.scorers.count, scorers.length
        end
      end
    end
  end
end
