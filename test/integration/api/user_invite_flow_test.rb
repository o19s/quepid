# frozen_string_literal: true

require 'test_helper'

class UserInviteFlowTest < ActionDispatch::IntegrationTest
  include ActionMailer::TestHelper

  it 'can send an invite and they respond' do
    assert_routing(
      {
        method: 'put',
        path:   '/api/cases/44/queries/62/ratings',
      },
      controller: 'api/v1/queries/ratings',
      action:     'update',
      format:     :json,
      case_id:    '44',
      query_id:   '62'
    )
  end

  test "invite friend" do
    #@controller = Api::V1::TeamMembersController.new
    user = User.all.first
    post users_login_url params: { email: 'doug@example.com', password: 'password', format: :json }
    #login_user user

    # Asserts the difference in the ActionMailer::Base.deliveries
    team = Team.find_by(name: 'valid team')
    require 'pp'
    pp team
    puts ActionMailer::Base.deliveries

    pp ActionMailer::Base.deliveries
    assert_emails 1 do
      post api_team_members_invite_url(team), params: { id: 'friend@example.com' }
    end
    pp ActionMailer::Base.deliveries

    puts "GET EMAIL 1"
    pp ActionMailer::Base.deliveries[0].body

    mail = ActionMailer::Base.deliveries.last
    puts mail.parts[0]

    puts mail.parts[0]

    token_from_email = mail.parts[0].to_s.gsub!(/invitation_token=\w*/).first.split('=')[1]

    invitee = User.find_by(email: 'friend@example.com')

    puts "raw token:"
    puts token_from_email
    assert invitee.created_by_invite?
    assert_not invitee.invitation_accepted?

    get logout_url params: { format: :json }

    get accept_user_invitation_url(invitation_token: token_from_email)

    invitee.reload
    assert invitee.invitation_accepted?


  end
end
