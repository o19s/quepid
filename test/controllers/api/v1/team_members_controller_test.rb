# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    class TeamMembersControllerTest < ActionController::TestCase
      let(:user)                  { users(:team_owner) }
      let(:member1)               { users(:team_member_1) }
      let(:member2)               { users(:team_member_2) }
      let(:wants_to_be_a_member)  { users(:wants_to_be_a_member) }
      let(:team)                  { teams(:team_owner_team) }
      let(:other_team)            { teams(:valid) }
      let(:shared_team)           { teams(:shared_team) }

      before do
        @controller = Api::V1::TeamMembersController.new

        login_user user
      end

      describe 'Adds new members to team' do
        test 'adds a new member successfully using the username' do
          assert_difference 'team.members.count' do
            post :create, team_id: team.id, id: wants_to_be_a_member.username

            assert_response :ok
          end
        end

        test 'adds a new member successfully using the id' do
          assert_difference 'team.members.count' do
            post :create, team_id: team.id, id: wants_to_be_a_member.id

            assert_response :ok
          end
        end

        test 'does not add an existing member' do
          assert_difference 'team.members.count', 0 do
            post :create, team_id: team.id, id: member1.username

            assert_response :ok
          end
        end

        test 'returns a not found error when the new member does not exist' do
          post :create, team_id: team.id, id: 'foo'

          assert_response :not_found
        end

        test "returns a not found error when the team can't be access by the user" do
          post :create, team_id: other_team.id

          assert_response :not_found
        end

        test 'allows member to add new members' do
          post :create, team_id: shared_team.id, id: wants_to_be_a_member.id

          assert_response :ok
        end

        describe 'analytics' do
          test 'posts event' do
            expects_any_ga_event_call

            perform_enqueued_jobs do
              post :create, team_id: team.id, id: wants_to_be_a_member.username

              assert_response :ok
            end
          end
        end
      end

      describe 'Removes a member from team' do
        test 'deletes existing member successfully using the username' do
          assert_difference 'team.members.count', -1 do
            delete :destroy, team_id: team.id, id: member1.username

            assert_response :no_content
          end
        end

        test 'deletes existing member successfully using the id' do
          assert_difference 'team.members.count', -1 do
            delete :destroy, team_id: team.id, id: member1.id

            assert_response :no_content
          end
        end

        test "returns a not found error when the team can't be access by the user" do
          delete :destroy, team_id: other_team.id, id: 'foo'

          assert_response :not_found
        end

        test 'allows member to remove members' do
          delete :destroy, team_id: shared_team.id, id: 'foo'

          assert_response :no_content
        end

        test 'does nothing when the member does not exist' do
          delete :destroy, team_id: team.id, id: 'foo'

          assert_response :no_content
        end
      end

      describe 'Lists all team members' do
        test "returns a list of all the team's members" do
          get :index, team_id: team.id

          assert_response :ok

          members = JSON.parse(response.body)['members']

          assert_instance_of  Array, members
          assert_equal        team.members.count, members.length

          ids = members.map { |member| member['id'] }

          assert_includes ids, member1.id
          assert_includes ids, member2.id
        end
      end
    end
  end
end
