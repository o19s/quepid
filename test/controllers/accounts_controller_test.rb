# frozen_string_literal: true

require 'test_helper'

class AccountsControllerTest < ActionController::TestCase
  let(:user) { users(:random) }

  before do
    @controller = AccountsController.new
  end

  describe 'updates password' do
    describe 'when user is not signed in' do
      test 'returns an unauthorized error' do
        patch :update

        assert_redirected_to new_session_path
      end
    end

    describe 'when user is signed in' do
      before do
        login_user user
      end

      test 'updates user password' do
        current_password = 'password'
        password      = 'newpass'

        data          = {
          current_password:      current_password,
          password:              password,
          password_confirmation: password,
        }

        patch :update, params: data

        assert_redirected_to profile_path
        assert_equal flash[:success], 'Account updated successfully.'
      end

      test 'requires all fields to be filled' do
        current_password = 'password'
        password      = ''

        data          = {
          current_password:      current_password,
          password:              password,
          password_confirmation: password,
        }

        patch :update, params: data

        assert_template 'profiles/show'
        assert_equal flash[:error], 'Oooops! Something happened, please double check your values and try again.'
      end

      test 'requires a valid current password' do
        current_password = 'foo'
        password      = 'newpass'

        data          = {
          current_password:      current_password,
          password:              password,
          password_confirmation: password,
        }

        patch :update, params: data

        assert_template 'profiles/show'
        assert_equal flash[:error], 'The original password is incorrect.'
      end

      test 'requires new password to match confirmation password' do
        current_password = 'password'
        password      = 'newpass'

        data          = {
          current_password:      current_password,
          password:              password,
          password_confirmation: 'bar',
        }

        patch :update, params: data

        assert_template 'profiles/show'
        assert user.errors.full_messages_for(:password_confirmation)
          .include?("Password confirmation doesn't match Password")
        assert_equal flash[:error], 'Oooops! Something happened, please double check your values and try again.'
      end

      describe 'analytics' do
        test 'posts event' do
          expects_any_ga_event_call

          current_password = 'password'
          password      = 'newpass'

          data          = {
            current_password:      current_password,
            password:              password,
            password_confirmation: password,
          }

          perform_enqueued_jobs do
            patch :update, params: data

            assert_redirected_to profile_path
          end
        end
      end
    end
  end

  describe 'deletes an account' do
    describe 'when a user is just a simple user' do
      let(:user) { users(:matt) }
      before do
        login_user user
      end
      test 'basic delete succeeds' do
        assert_difference('Case.count', -1) do
          assert_difference('User.count', -1) do
            delete :destroy, params: { id: user.id }
          end
        end
        assert_redirected_to sessions_path
      end
    end

    # describe 'when a user owns a team' do
    #   let(:user)          { users(:team_owner) }
    #   let(:team_member_1) { users(:team_member_1) }
    #   let(:shared_team_case) { cases(:shared_team_case) }
    #   before do
    #     login_user user
    #   end

    #   test 'user who owns a team and can not delete it gets error' do
    #     delete :destroy, params: { id: user.id }

    #     assert_template 'profiles/show'
    #   end

    #   test 'user reassigns their team first' do
    #     team = user.teams.first
    #     team.owner = team_member_1
    #     team.save

    #     assert_not shared_team_case.destroyed?

    #     assert_difference('User.count', -1) do
    #       delete :destroy, params: { id: user.id }
    #       assert_redirected_to sessions_path
    #     end

    #     shared_team_case.reload
    #     assert_not shared_team_case.destroyed?
    #   end
    # end
  end
end
