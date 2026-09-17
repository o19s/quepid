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
        assert_equal 'Account updated successfully.', flash[:success]
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
        assert_equal 'Oooops! Something happened, please double check your values and try again.', flash[:error]
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
        assert_equal 'The original password is incorrect.', flash[:error]
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

        assert_response :unprocessable_content
        assert_template 'profiles/show'
        assert_includes user.errors.full_messages_for(:password_confirmation), "Password confirmation doesn't match Password"
        assert_equal 'Oooops! Something happened, please double check your values and try again.', flash[:error]
        assert_select '#error_explanation_account_security'
        assert_select '#error_explanation_profile', count: 0
        assert_select '#error_explanation_danger_zone', count: 0
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

    describe 'when the user has judgements needing reassignment' do
      let(:user) { users(:random) }

      before do
        book = Book.create!(name: 'A book needing reassignment', owner: users(:doug))
        qdp = book.query_doc_pairs.create!(query_text: 'a query', doc_id: 'doc-1')
        qdp.judgements.create!(user: user, rating: 1.0)
        login_user user
      end

      test 're-renders show with only the danger-zone section showing its errors' do
        assert_no_difference('User.count') do
          delete :destroy, params: { id: user.id }
        end

        assert_response :unprocessable_content
        assert_template 'profiles/show'
        assert_select '#error_explanation_danger_zone'
        assert_select '#error_explanation_profile', count: 0
        assert_select '#error_explanation_account_security', count: 0
      end
    end
  end
end
