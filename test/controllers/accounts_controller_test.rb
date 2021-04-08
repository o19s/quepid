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

        assert_redirected_to secure_path
      end
    end

    describe 'when user is signed in' do
      before do
        login_user user
      end

      test 'updates user password' do
        old_password  = 'password'
        password      = 'newpass'

        data          = {
          current_password: old_password,
          new_password:     password,
          confirm_password: password,
        }

        patch :update, params: data

        assert_redirected_to profile_path
        assert_equal flash[:success], 'Account updated successfully.'
      end

      test 'requires all fields to be filled' do
        old_password  = ''
        password      = 'newpass'

        data          = {
          current_password: old_password,
          new_password:     password,
          confirm_password: password,
        }

        patch :update, params: data

        assert_template 'profiles/show'
        assert_equal flash[:error], 'Please fill all required fields.'

        old_password  = 'password'
        password      = ''

        data          = {
          current_password: old_password,
          new_password:     password,
          confirm_password: password,
        }

        patch :update, params: data

        assert_template 'profiles/show'
        assert_equal flash[:error], 'Please fill all required fields.'
      end

      test 'requires a valid current password' do
        old_password  = 'foo'
        password      = 'newpass'

        data          = {
          current_password: old_password,
          new_password:     password,
          confirm_password: password,
        }

        patch :update, params: data

        assert_template 'profiles/show'
        assert_equal flash[:error], 'The original password is incorrect.'
      end

      test 'requires new password to match confirmation password' do
        old_password  = 'foo'
        password      = 'newpass'

        data          = {
          current_password: old_password,
          new_password:     password,
          confirm_password: 'bar',
        }

        patch :update, params: data

        assert_template 'profiles/show'
        assert_equal flash[:error], 'The new passwords do not match!'
      end

      describe 'analytics' do
        test 'posts event' do
          expects_any_ga_event_call

          old_password  = 'password'
          password      = 'newpass'

          data          = {
            current_password: old_password,
            new_password:     password,
            confirm_password: password,
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
        assert_redirected_to secure_path
      end
    end

    describe 'when a user owns a team' do
      let(:user)          { users(:team_owner) }
      let(:team_member_1) { users(:team_member_1) }
      let(:shared_team_case) { cases(:shared_team_case) }
      before do
        login_user user
      end

      test 'user who owns a team' do
        delete :destroy, params: { id: user.id }

        assert_template 'profiles/show'

        # assert_includes user.errors['base'], 'Please reassign ownership of the team Team owned by Team Owner User'
        # assert_equal flash[:error], 'Please reassign ownership of the team Team owned by Team Owner User'
      end

      test 'user reassigns their team first' do
        team = user.teams.first
        team.owner = team_member_1
        team.save

        assert_not shared_team_case.destroyed?

        assert_difference('User.count', -1) do
          delete :destroy, params: { id: user.id }
          assert_redirected_to secure_path
        end

        shared_team_case.reload
        assert_not shared_team_case.destroyed?
      end
    end
  end
end
