# frozen_string_literal: true

# == Schema Information
#
# Table name: users
#
#  id                     :integer          not null, primary key
#  username               :string(80)
#  password               :string(120)
#  agreed_time            :datetime
#  agreed                 :boolean
#  first_login            :boolean
#  num_logins             :integer
#  scorer_id              :integer
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

class UserTest < ActiveSupport::TestCase
  test 'membership in team' do
    assert_includes users(:doug).teams, teams(:shared)
  end

  test 'ownership of team' do
    assert_includes users(:doug).owned_teams, teams(:valid)
  end

  test 'search for cases I can access' do
    doug = users(:doug)
    assert_not_nil doug.find_case(cases(:one).id)
    assert_not_nil doug.find_case(cases(:shared_through_owned_team).id)
    assert_not_nil doug.find_case(cases(:shared_with_team).id)
  end

  describe 'Defaults' do
    test 'are set when user is created' do
      user = User.create(username: 'defaults@email.com', password: 'password')

      assert_not_nil user.first_login
      assert_not_nil user.num_logins

      assert_equal true,  user.first_login
      assert_equal 0,     user.num_logins
    end

    test 'do not override the passed in arguments' do
      user = User.create(
        username:    'defaults@email.com',
        password:    'password',
        first_login: false,
        num_logins:  1
      )

      assert_not_nil user.first_login
      assert_not_nil user.num_logins

      assert_equal false, user.first_login
      assert_equal 1,     user.num_logins
    end
  end

  describe 'Password' do
    let(:user) { users(:doug) }

    test 'encrypts password when creating a new password' do
      password = 'password'
      new_user = User.create(username: 'new@user.com', password: password)

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

  describe 'Default Case' do
    test 'when user is created a default case is automatically created' do
      assert_difference 'Case.count' do
        user = User.create username: 'foo', password: 'foobar'

        assert_not_nil  user.cases
        assert_equal    user.cases.count, 1

        first_case = user.cases.first

        assert_not_nil  first_case
        assert_equal    first_case.case_name, Case::DEFAULT_NAME
      end
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
end
