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
end
