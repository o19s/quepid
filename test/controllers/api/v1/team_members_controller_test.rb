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
        Ahoy.track_bots = true

        @controller = Api::V1::TeamMembersController.new

        login_user user
      end

      describe 'Adds new members to team' do
        test 'adds a new member successfully using the email' do
          assert_difference 'team.members.count' do
            post :create, params: { team_id: team.id, id: wants_to_be_a_member.email }

            assert_response :ok
          end
        end

        test 'adds a new member successfully using the id' do
          assert_difference 'team.members.count' do
            post :create, params: { team_id: team.id, id: wants_to_be_a_member.id }

            assert_response :ok
          end
        end

        test 'does not add an existing member' do
          assert_difference 'team.members.count', 0 do
            post :create, params: { team_id: team.id, id: member1.email }

            assert_response :ok
          end
        end

        test 'returns a not found error when the new member does not exist' do
          post :create, params: { team_id: team.id, id: 'foo' }

          assert_response :not_found
        end

        test "returns a not found error when the team can't be access by the user" do
          post :create, params: { team_id: other_team.id }

          assert_response :not_found
        end

        test 'allows member to add new members' do
          post :create, params: { team_id: shared_team.id, id: wants_to_be_a_member.id }

          assert_response :ok
        end

        describe 'analytics' do
          test 'posts event' do
            expects_any_ga_event_call

            perform_enqueued_jobs do
              post :create, params: { team_id: team.id, id: wants_to_be_a_member.email }

              assert_response :ok
            end
          end
        end
      end

      describe 'Invites a new user to join Quepid and a team' do
        test 'invites a new member successfully using the email' do
          assert_difference 'team.members.count' do
            invitee_email = 'newperson@example.com'

            post :invite, params: { team_id: team.id, id: invitee_email }
            assert_response :ok

            assert response.parsed_body['pending_invite']

            user = User.find_by(email: invitee_email)
            assert_not_nil user.stored_raw_invitation_token
            assert_not_equal user.stored_raw_invitation_token, user.invitation_token
          end
        end
      end

      describe 'Removes a member from team' do
        test 'deletes existing member successfully using the email' do
          assert_difference 'team.members.count', -1 do
            delete :destroy, params: { team_id: team.id, id: member1.email }

            assert_response :no_content
          end
        end

        test 'deletes existing member successfully using the id' do
          assert_difference 'team.members.count', -1 do
            delete :destroy, params: { team_id: team.id, id: member1.id }

            assert_response :no_content
          end
        end

        test "returns a not found error when the team can't be access by the user" do
          delete :destroy, params: { team_id: other_team.id, id: 'foo' }

          assert_response :not_found
        end

        test 'allows member to remove members' do
          delete :destroy, params: { team_id: shared_team.id, id: 'foo' }

          assert_response :no_content
        end

        test 'does nothing when the member does not exist' do
          delete :destroy, params: { team_id: team.id, id: 'foo' }

          assert_response :no_content
        end
      end

      describe 'Lists all team members' do
        test "returns a list of all the team's members" do
          get :index, params: { team_id: team.id }

          assert_response :ok

          members = response.parsed_body['members']

          assert_instance_of  Array, members
          assert_equal        team.members.count, members.length

          ids = members.map { |member| member['id'] }

          assert_includes ids, member1.id
          assert_includes ids, member2.id
        end

        describe 'pending invite logic' do
          test 'outstanding invite returns pending invite' do
            post :invite, params: { team_id: team.id, id: 'invitee@mail.com' }
            assert_response :ok
            invitee = User.find_by(email: 'invitee@mail.com')

            get :index, params: { team_id: team.id }

            assert_response :ok
            members = response.parsed_body['members']
            member = members.find { |m| m['id'].to_i == invitee.id }
            assert member['pending_invite']
          end

          test "accepted invite doesn't return pending invite" do
            post :invite, params: { team_id: team.id, id: 'invitee@mail.com' }
            assert_response :ok
            invitee = User.find_by(email: 'invitee@mail.com')
            User.accept_invitation!(invitation_token: invitee.stored_raw_invitation_token, password: 'ad97nwj3o2',
                                    name: 'John Doe')
            assert_response :ok

            get :index, params: { team_id: team.id }

            assert_response :ok
            members = response.parsed_body['members']
            member = members.find { |m| m['id'].to_i == invitee.id }
            assert_not member['pending_invite']
          end

          test "pending invite, that is ignored and account directly created doesn't return pending invite" do
            post :invite, params: { team_id: team.id, id: 'invitee@mail.com' }
            assert_response :ok
            invitee = User.find_by(email: 'invitee@mail.com')
            invitee.update(password: 'temppassword', name: 'john doe') # don't accept invite, just signup directly.

            get :index, params: { team_id: team.id }

            assert_response :ok
            members = response.parsed_body['members']
            member = members.find { |m| m['id'].to_i == invitee.id }
            assert_not member['pending_invite']
          end
        end
      end
    end
  end
end
