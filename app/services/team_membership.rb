# frozen_string_literal: true

# Controllers retain their lookup policy, signup gate and response handling.
class TeamMembership
  def initialize user, team
    @user = user
    @team = team
  end

  def invite email
    User.invite!({ email: email, password: '' }, @user) do |member|
      member.skip_invitation = Rails.application.config.action_mailer.delivery_method.blank?
    end
  end

  def invitation_message member
    member.skip_invitation.present? ? "Please share the invite link with #{member.email} directly so they can join." : "Invitation email was sent to #{member.email}"
  end

  # HTML existing-user additions track only a newly added membership.
  # rubocop:disable-next Naming/PredicateMethod -- Membership mutation, not a predicate.
  def add member
    return false unless append(member)

    track_added(member)
    true
  end

  # API additions and invitations retain their team-save validation and track
  # successful requests even when the membership already exists.
  # rubocop:disable-next Naming/PredicateMethod -- Membership mutation, not a predicate.
  def add_and_save member
    append(member)
    return false unless @team.save

    track_added(member)
    true
  end

  # rubocop:disable-next Naming/PredicateMethod -- Membership mutation, not a predicate.
  def remove member, track: true
    return false unless @team.members.exists?(member.id)

    @team.members.delete(member)
    Analytics::Tracker.track_member_removed_from_team_event(@user, @team, member) if track
    true
  end

  private

  # rubocop:disable-next Naming/PredicateMethod -- Membership mutation, not a predicate.
  def append member
    return false if @team.members.exists?(member.id)

    @team.members << member
    true
  end

  def track_added member
    Analytics::Tracker.track_member_added_to_team_event(@user, @team, member)
  end
end
