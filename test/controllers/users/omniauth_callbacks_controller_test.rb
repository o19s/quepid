# frozen_string_literal: true

require 'test_helper'

module Users
  class OmniauthCallbacksControllerTest < ActionController::TestCase
    let(:user) { users(:admin) }
    let(:locked_user) { users(:locked_user) }

    before do
      OmniAuth.config.test_mode = true
      @request.env['devise.mapping'] = Devise.mappings[:user]
      OmniAuth.config.mock_auth[:google_oauth2] = OmniAuth::AuthHash.new({
        provider: 'google_oauth2',
        info:     { 'email' => locked_user.email, 'name' => locked_user.name, 'image' => '' },
      })
      @controller = Users::OmniauthCallbacksController.new
    end

    after do
      Rails.application.config.signup_enabled = true
    end

    describe 'Logs in via Google' do
      test 'logs in an existing user' do
        user = users(:random)

        OmniAuth.config.add_mock(:google_oauth2, { info: { 'email' => user.email } })
        @request.env['omniauth.auth'] = OmniAuth.config.mock_auth[:google_oauth2]

        assert_nil @controller.ahoy.user

        post :google_oauth2

        assert_not_nil @controller.ahoy.user
        assert_redirected_to root_path
        assert_nil flash[:alert]
      end

      test 'increments the num logins' do
        user = users(:random)
        user.num_logins = original_number = 1
        user.save

        OmniAuth.config.add_mock(:google_oauth2, { info: { 'email' => user.email } })
        @request.env['omniauth.auth'] = OmniAuth.config.mock_auth[:google_oauth2]

        post :google_oauth2
        assert_not_nil @controller.ahoy.user

        user.reload
        assert_equal user.num_logins, original_number + 1
      end

      test 'pukes on a existing locked user' do
        OmniAuth.config.add_mock(:google_oauth2, { info: { 'email' => locked_user.email } })
        @request.env['omniauth.auth'] = OmniAuth.config.mock_auth[:google_oauth2]

        post :google_oauth2

        assert_redirected_to root_path
        assert_equal flash[:alert], 'Can\'t log in a locked user.'
        assert_nil session[:current_user_id], 'does not set a user'
      end

      test 'pukes on creating a new user when signup disabled' do
        Rails.application.config.signup_enabled = false

        OmniAuth.config.add_mock(:google_oauth2, { info: { 'email' => 'fake@fake.com' } })
        @request.env['omniauth.auth'] = OmniAuth.config.mock_auth[:google_oauth2]

        post :google_oauth2

        assert_nil @controller.ahoy.user
        assert_redirected_to root_path
        assert_equal flash[:alert], 'You can only sign in with already created users.'
        assert_nil session[:current_user_id], 'does not set a user'
        Rails.application.config.signup_enabled = true
      end
    end
  end
end
