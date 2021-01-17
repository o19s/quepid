# frozen_string_literal: true

require 'test_helper'

class UserInviteFlowTest < ActionDispatch::IntegrationTest
  include ActionMailer::TestHelper

  test 'invite friend to join my team on Quepid' do
    post users_login_url params: { email: 'doug@example.com', password: 'password', format: :json }

    # Asserts the difference in the ActionMailer::Base.deliveries
    team = Team.find_by(name: 'valid team')
    assert_emails 1 do
      post api_team_members_invite_url(team), params: { id: 'friend@example.com' }
    end

    mail = ActionMailer::Base.deliveries.last

    raw_token_from_email = mail.parts[0].to_s.gsub!(/.*invitation_token=(.*)[\s\r\n].*/).first.split('=')[1].strip

    invitee = User.find_by(email: 'friend@example.com')

    assert invitee.created_by_invite?
    assert_not invitee.invitation_accepted?

    get logout_url params: { format: :json }

    get accept_user_invitation_url(invitation_token: raw_token_from_email)

    invitee.reload
    assert_not invitee.invitation_accepted?

    # rubocop:disable Layout/HashAlignment
    put user_invitation_url(
      params: {
        user: {
          invitation_token:       raw_token_from_email,
          name:                   'Bob',
          email:                  'friend@example.com',
          password:               'password',
          password_confirmation:  'password',
          agreed:                 'true',
        },
      }
    )
    # rubocop:enable Layout/HashAlignment
    assert_response :redirect

    invitee.reload

    assert invitee.invitation_accepted?
    assert_equal invitee.name, 'Bob'
  end
end
