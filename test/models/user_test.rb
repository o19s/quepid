# frozen_string_literal: true

require 'test_helper'

# == Schema Information
#
# Table name: users
#
#  id                          :integer          not null, primary key
#  administrator               :boolean          default(FALSE)
#  agreed                      :boolean
#  agreed_time                 :datetime
#  company                     :string(255)
#  completed_case_wizard       :boolean          default(FALSE), not null
#  email                       :string(80)
#  email_marketing             :boolean          default(FALSE), not null
#  invitation_accepted_at      :datetime
#  invitation_created_at       :datetime
#  invitation_limit            :integer
#  invitation_sent_at          :datetime
#  invitation_token            :string(255)
#  invitations_count           :integer          default(0)
#  llm_key                     :string(4000)
#  locked                      :boolean
#  locked_at                   :datetime
#  name                        :string(255)
#  num_logins                  :integer
#  options                     :json
#  password                    :string(120)
#  profile_pic                 :string(4000)
#  reset_password_sent_at      :datetime
#  reset_password_token        :string(255)
#  stored_raw_invitation_token :string(255)
#  system_prompt               :string(4000)
#  created_at                  :datetime         not null
#  updated_at                  :datetime         not null
#  default_scorer_id           :integer
#  invited_by_id               :integer
#
# Indexes
#
#  index_users_on_default_scorer_id     (default_scorer_id)
#  index_users_on_invitation_token      (invitation_token) UNIQUE
#  index_users_on_invited_by_id         (invited_by_id)
#  index_users_on_name                  (name)
#  index_users_on_reset_password_token  (reset_password_token) UNIQUE
#  ix_user_username                     (email) UNIQUE
#
# Foreign Keys
#
#  fk_rails_...  (default_scorer_id => scorers.id)
#  fk_rails_...  (invited_by_id => users.id)
#

class UserTest < ActiveSupport::TestCase
  # Could reorganize this test around AI Judges and Regular Users
  test 'membership in team' do
    assert_includes users(:doug).teams, teams(:shared)
  end

  describe 'Defaults' do
    test 'are set when user is created' do
      user = User.create(email: 'defaults@email.com', password: 'password')

      assert_not_nil user.completed_case_wizard
      assert_not_nil user.num_logins

      assert_not user.completed_case_wizard
      assert_equal 0,                        user.num_logins
      assert_equal user.default_scorer.name, Rails.application.config.quepid_default_scorer
    end

    test 'do not override the passed in arguments' do
      user = User.create(
        email:                 'defaults@email.com',
        password:              'password',
        completed_case_wizard: true,
        num_logins:            1
      )

      assert_not_nil user.completed_case_wizard
      assert_not_nil user.num_logins

      assert user.completed_case_wizard
      assert_equal 1, user.num_logins
    end
  end

  describe 'Password' do
    let(:user) { users(:doug) }

    test 'encrypts password when creating a new password' do
      password = 'password'
      new_user = User.create(email: 'new@user.com', password: password)

      assert_not_equal password, new_user.password
      assert_equal BCrypt::Password.new(new_user.password), password
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
      assert_equal BCrypt::Password.new(user.password), password
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
      assert_predicate user, :terms_and_conditions?

      password = 'password'
      new_user = User.create(email: 'new@user.com', password: password, agreed: true)
      assert_not_nil new_user.agreed_time
    end

    test 'Sets agreed_time when agreed set to true when T&C not set' do
      terms_and_conditions_url = Rails.application.config.terms_and_conditions_url
      Rails.application.config.terms_and_conditions_url = ''
      user = User.create
      assert_not user.terms_and_conditions?

      Rails.application.config.terms_and_conditions_url = nil
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
      new_user = User.create(email: nil, password: 'password')

      assert new_user.errors.added? :email, :blank # => true
      assert_includes new_user.errors.messages[:email], 'can\'t be blank'

      new_user = User.create(email: 'epugh', password: 'password')
      assert_includes new_user.errors.messages[:email], 'is invalid'

      new_user = User.create(email: 'epugh@', password: 'password')
      assert_includes new_user.errors.messages[:email], 'is invalid'

      # turns out this is a valid format at least as far as regex validation goes!
      new_user = User.create(email: 'epugh@o19s', password: 'password')
      assert_empty new_user.errors.messages

      new_user = User.create(email: 'epugh@o19s.com', password: 'password')
      assert_empty new_user.errors.messages
      new_user = User.create(email: 'epugh+tag@o19s.com', password: 'password')
      assert_empty new_user.errors.messages
    end

    test 'prevents duplicate emails' do
      user = User.create(email: 'defaults@email.com', password: 'password')
      assert_empty user.errors.messages

      new_user = User.create(email: 'defaults@email.com', password: 'password')
      assert_includes new_user.errors.messages[:email], 'has already been taken'

      new_user = User.create(email: 'DeFaultS@emaiL.COM', password: 'password')
      assert_includes new_user.errors.messages[:email], 'has already been taken'
    end
  end

  describe 'Name' do
    test 'does not require name to be present' do
      user = User.create(email: 'foo@example.com', password: 'password')
      assert_not user.ai_judge?
      assert_predicate user, :valid?
      user.name = 'User Bob'
      assert_predicate user, :valid?
    end
  end

  describe 'Default Case' do
    # we used to create the default case for every user, but that assumptions doesn't make sense anymore.
    test 'when user is created a default case is NOT automatically created' do
      case_count = Case.count
      user = User.create email: 'foo@example.com', password: 'foobar'

      assert_not_nil  user.cases
      assert_equal    0, user.cases.count
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

      assert_predicate user, :locked?
    end

    it 'unlocks a user' do
      user.lock
      user.save

      assert_predicate user, :locked?

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

    it 'ensures a user who is a member of a team that is deleted keeps the team' do
      user.destroy
      assert_not team.destroyed?
      assert_predicate user, :destroyed?
    end

    it 'prevents a user who owns a scorer shared with a team from being deleted' do
      # need to null out the judgements first
      random.judgements.each do |j|
        j.user = nil
        j.save!
      end
      random.reload

      random.destroy
      assert_not random.destroyed?
      assert_includes random.errors.full_messages_for(:base), 'Please remove the scorer Scorer for sharing from the team before deleting this user.'
    end

    it 'deletes a user and their team if no one else is in the team' do
      team = team_owner.teams.first
      team.save

      assert_not shared_team_case.destroyed?

      assert_difference('User.count', -1) do
        team_owner.destroy
        assert_predicate team_owner, :destroyed?
      end

      shared_team_case.reload
      assert_not shared_team_case.destroyed?
    end
  end

  describe 'User accessing Books' do
    let(:user_with_book_access)             { users(:doug) }
    let(:user_without_book_access)          { users(:joey) }
    let(:book_of_comedy_films)              { books(:book_of_comedy_films) }
    let(:book_of_star_wars_judgements)      { books(:book_of_star_wars_judgements) }

    it 'provides access to the books that a user has access because of membership in a team' do
      assert_equal user_with_book_access.books_involved_with.where(id: book_of_star_wars_judgements.id).first, book_of_star_wars_judgements
    end

    it 'prevents access to the books because the user is not part of a team' do
      assert_nil user_without_book_access.books_involved_with.where(id: book_of_comedy_films).first
    end

    it 'prevents you from deleting a user that has judgements' do
      assert_predicate user_with_book_access.judgements.size, :positive?

      assert_not user_with_book_access.destroy
      assert_includes user_with_book_access.errors, :base
      assert_not user_with_book_access.destroyed?
    end
  end

  describe 'User accessing Search Endpoints' do
    let(:user_with_search_endpoint) { users(:doug) }
    let(:joey) { users(:joey) }
    let(:es_try) { search_endpoints(:es_try) }
    let(:one) { search_endpoints(:one) }
    let(:for_case_with_one_try) { search_endpoints(:for_case_with_one_try) }

    it 'provides access to the search end points that a user has access because of membership in a team' do
      assert_includes user_with_search_endpoint.search_endpoints_involved_with, one
    end

    it 'does NOT provide access to the search end points for a user just because of using it in a try in a case the user has access to' do
      assert_not_includes joey.search_endpoints_involved_with, for_case_with_one_try
    end

    it 'prevents access to the search endpoint because the user is not part of a team' do
      assert_not_includes user_with_search_endpoint.search_endpoints_involved_with, es_try
    end

    it 'provides access to the search end point that the user is the owner of it' do
      search_endpoint = one
      search_endpoint.owner = joey
      search_endpoint.save!

      assert_includes joey.search_endpoints_involved_with, search_endpoint
    end
  end

  describe 'User is AI Judge' do
    let(:joey) { users(:joey) }
    it 'uses the existence of the key to decide ai_judge' do
      user = User.new
      assert_not user.ai_judge?
      user.llm_key = ''
      assert_predicate user, :ai_judge?
      assert_not user.valid?
    end

    it 'does not require an email or password address to be valid when is a judge' do
      user = User.new(llm_key: '1234', name: 'Judge Judy')
      assert_predicate user, :ai_judge?
      assert_predicate user, :valid?
    end

    it 'does require name to be valid when is a judge' do
      user = User.new(llm_key: '1234')
      assert_predicate user, :ai_judge?
      assert_not user.valid?
      user.name = 'Judge Judy'
      assert_predicate user, :valid?
    end

    describe 'options to configure the llm server' do
      it 'provides an empty hash' do
        user = User.new(llm_key: '1234', name: 'Judge Judy')
        opts_hash = user.judge_options
        assert_empty(opts_hash)
      end

      it 'lets you update the options hash via passing in a hash with new values' do
        user = User.new(llm_key: '1234', name: 'Judge Judy')
        opts_hash = user.judge_options

        opts_hash[:model] = 'gpt-3.5-turbo'
        assert_equal('gpt-3.5-turbo', opts_hash[:model])
        user.judge_options = opts_hash
        user.save!

        user.reload
        assert_equal('gpt-3.5-turbo', user.judge_options[:model])
      end

      it 'works with other prexisting options' do
        joey.options = { special_options: { key1: 'opt1', key2: 2, key3: true } }
        assert joey.save

        judge_options = joey.judge_options
        judge_options[:model] = 'gpt-3.5-turbo'
        joey.judge_options = judge_options
        assert joey.save!
        joey.reload

        judge_options = joey.judge_options
        assert_equal('gpt-3.5-turbo', judge_options[:model])
      end
    end
  end

  describe 'The full name of the user' do
    it 'uses the name if possible' do
      user = User.new(name: 'bob')
      assert_equal('Bob', user.fullname)
    end

    it 'uses the email if no name' do
      user = User.new(email: 'bob@bob.com')
      assert_equal('bob@bob.com', user.fullname)
    end

    it 'handles it when we got nothing!' do
      user = User.new
      assert_equal('Anonymous', user.fullname)
    end
  end
end
