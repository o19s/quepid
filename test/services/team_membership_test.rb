# frozen_string_literal: true

require 'test_helper'

class TeamMembershipTest < ActiveSupport::TestCase
  include ActionMailer::TestHelper

  setup do
    @previous_ahoy = Thread.current[:ahoy]
    events = @analytics_events = []
    Thread.current[:ahoy] = Object.new
    Thread.current[:ahoy].define_singleton_method(:track) do |name, properties|
      events << [ name, properties ]
    end
    @user = users(:team_owner)
    @team = teams(:team_owner_team)
    @member = users(:wants_to_be_a_member)
    @membership = TeamMembership.new(@user, @team)
  end

  teardown do
    Thread.current[:ahoy] = @previous_ahoy
  end

  test 'HTML additions and removals track only actual membership changes' do
    assert @membership.add(@member)
    assert_not @membership.add(@member)
    assert_equal 1, @team.members.where(id: @member.id).count
    assert @membership.remove(@member)
    assert_not @membership.remove(@member)
    assert_equal 2, @analytics_events.length
    assert_match(/added/, @analytics_events.first.first)
    assert_match(/removed/, @analytics_events.last.first)
  end

  test 'API additions retain analytics for duplicate requests without duplicate membership' do
    assert @membership.add_and_save(@member)
    assert @membership.add_and_save(@member)
    assert_equal 1, @team.members.where(id: @member.id).count

    assert @membership.remove(@member, track: false)
    assert_not @team.members.exists?(@member.id)
    assert_equal 2, @analytics_events.length
    assert(@analytics_events.all? { |name, _properties| name.include?('added') })
  end

  test 'failed team validation does not emit an added event' do
    @team.name = ''
    assert_not @membership.add_and_save(users(:team_member_1))
    assert_empty @analytics_events
  end

  test 'unconfigured mail delivery creates a usable invitation with the direct-link message' do
    previous_delivery_method = Rails.application.config.action_mailer.delivery_method
    Rails.application.config.action_mailer.delivery_method = nil

    assert_emails 0 do
      member = @membership.invite('membership-service@example.com')
      assert_predicate member, :persisted?
      assert member.skip_invitation
      assert_predicate member.stored_raw_invitation_token, :present?
      assert @membership.add_and_save(member)
      assert_equal "Please share the invite link with #{member.email} directly so they can join.", @membership.invitation_message(member)
    end
  ensure
    Rails.application.config.action_mailer.delivery_method = previous_delivery_method
  end

  test 'configured mail delivery sends the invitation and returns the email message' do
    previous_delivery_method = Rails.application.config.action_mailer.delivery_method
    Rails.application.config.action_mailer.delivery_method = :test

    assert_emails 1 do
      member = @membership.invite('membership-email@example.com')
      assert_not member.skip_invitation
      assert_equal "Invitation email was sent to #{member.email}", @membership.invitation_message(member)
    end
  ensure
    Rails.application.config.action_mailer.delivery_method = previous_delivery_method
  end
end
