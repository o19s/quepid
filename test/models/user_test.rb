# frozen_string_literal: true

# == Schema Information
#
# Table name: users
#
#  id                     :integer          not null, primary key
#  email                  :string(80)
#  password               :string(120)
#  agreed_time            :datetime
#  agreed                 :boolean
#  completed_case_wizard  :boolean
#  num_logins             :integer
#  name                   :string(255)
#  administrator          :boolean          default(FALSE)
#  reset_password_token   :string(255)
#  reset_password_sent_at :datetime
#  company                :string(255)
#  locked                 :boolean
#  locked_at              :datetime
#  created_at             :datetime         not null
#  updated_at             :datetime         not null
#  default_scorer_id      :integer
#

require 'test_helper'
# rubocop:disable Layout/LineLength
class UserTest < ActiveSupport::TestCase
  test 'membership in team' do
    assert_includes users(:doug).teams, teams(:shared)
  end

  test 'ownership of team' do
    assert_includes users(:doug).owned_teams, teams(:valid)
  end

  describe 'Defaults' do
    test 'are set when user is created' do
      user = User.create(name: 'eric', email: 'defaults@email.com', password: 'password')

      assert_not_nil user.completed_case_wizard
      assert_not_nil user.num_logins

      assert_equal false, user.completed_case_wizard
      assert_equal 0,                        user.num_logins
      assert_equal user.default_scorer.name, Rails.application.config.quepid_default_scorer
    end

    test 'do not override the passed in arguments' do
      user = User.create(
        name:                  'eric',
        email:                 'defaults@email.com',
        password:              'password',
        completed_case_wizard: true,
        num_logins:            1
      )

      assert_not_nil user.completed_case_wizard
      assert_not_nil user.num_logins

      assert_equal true, user.completed_case_wizard
      assert_equal 1, user.num_logins
    end
  end

  describe 'Name' do
    let(:user) { users(:doug) }

    test 'missing name prompts validation error' do
      assert_equal true, user.valid?
      user.name = nil
      assert_equal false, user.valid?
      assert user.errors.added? :name, :blank
    end

    test 'empty name prompts validation error' do
      assert_equal true, user.valid?
      user.name = ''
      assert_equal false, user.valid?
      assert user.errors.added? :name, :blank
    end

    test 'can override the name validation check' do
      user.skip_name_validation = true
      user.name = nil
      assert_equal true, user.valid?
      assert_equal false, (user.errors.added? :name, :blank)
    end

  end

  describe 'Password' do
    let(:user) { users(:doug) }

    test 'encrypts password when creating a new password' do
      password = 'password'
      new_user = User.create(name: 'eric', email: 'new@user.com', password: password)

      assert_not_equal password, new_user.password
      assert BCrypt::Password.new(new_user.password) == password
    end

    test 'does not encrypt the password when updating a user without the password' do
      current_password = user.password
      user.update num_logins: 3

      assert_equal current_password, user.password
    end

    test "encrypts password when updating a user's password" do
      current_password  = user.password
      password          = 'newpass'
      user.update num_logins: 3, password: password

      assert_not_equal  current_password, user.password

      assert_not_equal  password, user.password
      assert BCrypt::Password.new(user.password) == password
    end
  end

  describe 'Agreed' do
    test 'Does not set agreed_time when agreed is nil or false' do
      password = 'password'
      new_user = User.create(email: 'new@user.com', password: password, agreed: nil)
      assert_nil new_user.agreed_time

      new_user = User.create(email: 'new@user.com', password: password, agreed: false)
      assert_nil new_user.agreed_time
    end

    test 'Sets agreed_time when agreed set to true when T&C set' do
      user = User.create
      assert user.terms_and_conditions?

      password = 'password'
      new_user = User.create(name: 'new user', email: 'new@user.com', password: password, agreed: true)
      assert_not_nil new_user.agreed_time
    end

    test 'Sets agreed_time when agreed set to true when T&C not set' do
      terms_and_conditions_url = Rails.application.config.terms_and_conditions_url
      Rails.application.config.terms_and_conditions_url = ''
      user = User.create
      assert_not user.terms_and_conditions?

      password = 'password'
      new_user = User.create(email: 'new@user.com', password: password, agreed: true)
      assert_nil new_user.agreed_time
      Rails.application.config.terms_and_conditions_url = terms_and_conditions_url
    end
  end

  describe 'Email' do
    test 'validates the format of the email address' do
      new_user = User.create(name: 'eric', email: nil, password: 'password')

      assert new_user.errors.added? :email, :blank # => true
      assert_includes new_user.errors.messages[:email], 'can\'t be blank'

      new_user = User.create(name: 'eric', email: 'epugh', password: 'password')
      assert_includes new_user.errors.messages[:email], 'is invalid'

      new_user = User.create(name: 'eric', email: 'epugh@', password: 'password')
      assert_includes new_user.errors.messages[:email], 'is invalid'

      # turns out this is a valid format at least as far as regex validation goes!
      new_user = User.create(name: 'eric', email: 'epugh@o19s', password: 'password')
      assert_empty new_user.errors.messages

      new_user = User.create(name: 'eric', email: 'epugh@o19s.com', password: 'password')
      assert_empty new_user.errors.messages
      new_user = User.create(name: 'eric', email: 'epugh+tag@o19s.com', password: 'password')
      assert_empty new_user.errors.messages
    end
  end

  describe 'Default Case' do
    # we used to create the default case for every user, but that assumptions doesn't make sense anymore.
    test 'when user is created a default case is NOT automatically created' do
      case_count = Case.count
      user = User.create email: 'foo@example.com', password: 'foobar'

      assert_not_nil  user.cases
      assert_equal    user.cases.count, 0
      assert_same     case_count, Case.count
    end
  end

  describe 'Lock User' do
    let(:user) { users(:random) }

    it 'defaults the user to unlocked' do
      assert_not user.locked?
    end

    it 'switches the user to locked' do
      user.lock
      user.save

      assert user.locked?
    end

    it 'unlocks a user' do
      user.lock
      user.save

      assert user.locked?

      user.reload
      user.unlock
      user.save

      assert_not user.locked?
    end
  end

  describe 'Delete User' do
    let(:user)          { users(:team_owner) }
    let(:team_member_1) { users(:team_member_1) }
    let(:shared_team_case) { cases(:shared_team_case) }
    let(:team) { teams(:valid) }

    let(:random) { users(:random) }

    let(:team_owner) { users(:team_owner) }
    let(:team_member_1) { users(:team_member_1) }
    let(:shared_team_case) { cases(:shared_team_case) }

    it 'prevents a user who owns a team that other people are in from being deleted' do
      user.destroy
      assert_not user.destroyed?

      assert user.errors.full_messages_for(:base).include?('Please reassign ownership of the team Team owned by Team Owner User.')
    end

    it 'prevents a user who owns a scorer shared with a team from being deleted' do
      random.destroy
      assert_not random.destroyed?
      assert random.errors.full_messages_for(:base).include?('Please remove the scorer Scorer for sharing from the team before deleting this user.')
    end

    it 'deletes a user and their team if no one else is in the team' do
      team = team_owner.teams.first
      team.owner = team_member_1
      team.save

      assert_not shared_team_case.destroyed?

      assert_difference('User.count', -1) do
        team_owner.destroy
        assert team_owner.destroyed?
      end

      shared_team_case.reload
      assert_not shared_team_case.destroyed?
    end
  end
end

# rubocop:enable Layout/LineLength
