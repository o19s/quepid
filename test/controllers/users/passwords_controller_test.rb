# frozen_string_literal: true

require 'test_helper'

module Users
  class PasswordsControllerTest < ActionDispatch::IntegrationTest
    let(:user) { users(:random) }

    def without_email_notifications
      original = Rails.application.config.action_mailer.delivery_method
      Rails.application.config.action_mailer.delivery_method = nil
      yield
    ensure
      Rails.application.config.action_mailer.delivery_method = original
    end

    describe 'POST create, requesting reset password instructions' do
      test 'sends the instructions and redirects to the root path' do
        post user_password_url, params: { user: { email: user.email } }

        assert_redirected_to root_path
        assert_not_nil user.reload.reset_password_token
      end

      test 'blocks the request and redirects to sign in when email is not configured' do
        without_email_notifications do
          post user_password_url, params: { user: { email: user.email } }
        end

        assert_redirected_to sessions_path
        assert_match(/Email delivery hasn't been set up/, flash[:alert])
        assert_nil user.reload.reset_password_token
      end
    end

    describe 'PUT update, resetting the password' do
      test 'resets the password and redirects to the root path' do
        token = user.send_reset_password_instructions
        new_password = 'a brand new password'

        put user_password_url, params: {
          user: {
            reset_password_token:  token,
            password:              new_password,
            password_confirmation: new_password,
          },
        }

        assert_redirected_to root_path

        user.reload
        assert_equal BCrypt::Password.new(user.password), new_password
      end

      test 'renders the form again when the passwords do not match' do
        token = user.send_reset_password_instructions

        put user_password_url, params: {
          user: {
            reset_password_token:  token,
            password:              'a brand new password',
            password_confirmation: 'does not match',
          },
        }

        assert_response :success
      end

      test 'blocks the request and redirects to sign in when email is not configured' do
        token = user.send_reset_password_instructions

        without_email_notifications do
          put user_password_url, params: {
            user: {
              reset_password_token:  token,
              password:              'a brand new password',
              password_confirmation: 'a brand new password',
            },
          }
        end

        assert_redirected_to sessions_path
        assert_match(/Email delivery hasn't been set up/, flash[:alert])
      end
    end

    describe 'GET new' do
      test 'renders the forgot password form' do
        get new_user_password_url

        assert_response :success
      end
    end
  end
end
