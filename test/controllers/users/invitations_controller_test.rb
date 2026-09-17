# frozen_string_literal: true

require 'test_helper'

module Users
  class InvitationsControllerTest < ActionDispatch::IntegrationTest
    let(:inviter) { users(:doug) }
    let(:team) { teams(:shared) }

    def invite_user email = 'invited_test_user@example.com'
      invitee = User.invite!({ email: email, password: '' }, inviter)
      team.members << invitee
      invitee
    end

    after do
      Rails.application.config.signup_enabled = true
    end

    describe 'PUT update, accepting an invitation' do
      test 'completes the signup, logs the user in, and redirects to their first team' do
        invitee = invite_user

        put user_invitation_url, params: {
          user: {
            invitation_token:      invitee.stored_raw_invitation_token,
            name:                  'Invited Person',
            password:              'super secret password',
            password_confirmation: 'super secret password',
            agreed:                true,
          },
        }

        assert_redirected_to team_path(team)

        invitee.reload
        assert_not_nil invitee.invitation_accepted_at
        assert_not_nil invitee.agreed_time
        assert_equal 'Invited Person', invitee.name
        assert_equal invitee.id, session[:current_user_id]
      end

      test 'tracks a signup analytics event' do
        expects_any_ga_event_call

        invitee = invite_user

        perform_enqueued_jobs do
          put user_invitation_url, params: {
            user: {
              invitation_token:      invitee.stored_raw_invitation_token,
              name:                  'Invited Person',
              password:              'super secret password',
              password_confirmation: 'super secret password',
              agreed:                true,
            },
          }
        end

        assert_redirected_to team_path(team)
      end

      test 'renders the form again when the passwords do not match' do
        invitee = invite_user

        put user_invitation_url, params: {
          user: {
            invitation_token:      invitee.stored_raw_invitation_token,
            name:                  'Invited Person',
            password:              'super secret password',
            password_confirmation: 'does not match',
            agreed:                true,
          },
        }

        assert_response :success

        invitee.reload
        assert_nil invitee.invitation_accepted_at
      end

      test 'blocks acceptance and redirects to sign in when signups are disabled' do
        Rails.application.config.signup_enabled = false

        invitee = invite_user

        put user_invitation_url, params: {
          user: {
            invitation_token:      invitee.stored_raw_invitation_token,
            name:                  'Invited Person',
            password:              'super secret password',
            password_confirmation: 'super secret password',
            agreed:                true,
          },
        }

        assert_redirected_to sessions_path
        assert_equal 'Signups are disabled.', flash[:error]

        invitee.reload
        assert_nil invitee.invitation_accepted_at
      end
    end

    describe 'GET edit, opening the accept-invitation form' do
      test 'renders successfully for a valid invitation token, without requiring login' do
        invitee = invite_user

        get accept_user_invitation_url(invitation_token: invitee.raw_invitation_token)

        assert_response :success
      end
    end
  end
end
