# frozen_string_literal: true

require 'test_helper'

module Users
  class SignupsControllerTest < ActionDispatch::IntegrationTest
    let(:valid_params) do
      {
        user: {
          name:                  'New Person',
          email:                 'new_person@example.com',
          password:              'super secret password',
          password_confirmation: 'super secret password',
          agreed:                '1',
        },
      }
    end

    def with_signup_terms url
      original = Rails.application.config.terms_and_conditions_url
      Rails.application.config.terms_and_conditions_url = url
      yield
    ensure
      Rails.application.config.terms_and_conditions_url = original
    end

    test 'creates a user, logs them in, and redirects home' do
      assert_difference('User.count') do
        post users_signup_url, params: valid_params
      end

      assert_redirected_to root_path
      user = User.find_by(email: 'new_person@example.com')
      assert_equal user.id, session[:current_user_id]
      assert_equal 'New Person', user.name
    end

    test 'tracks the signup event' do
      assert_difference(-> { Ahoy::Event.where(name: 'users:signed_up').count }) do
        post users_signup_url, params: valid_params
      end
    end

    test 'reuses an outstanding invited user instead of creating a duplicate' do
      invitee = User.invite!({ email: 'new_person@example.com', password: '' }, users(:doug))

      assert_no_difference('User.count') do
        post users_signup_url, params: valid_params
      end

      assert_redirected_to root_path
      invitee.reload
      assert_equal 'New Person', invitee.name
      assert_equal invitee.id, session[:current_user_id]
    end

    test 'does not reuse an existing accepted user' do
      existing = users(:random)
      params = valid_params
      params[:user][:email] = existing.email

      assert_no_difference('User.count') do
        post users_signup_url, params: params
      end

      assert_response :success
      assert_nil session[:current_user_id]
    end

    test 'a blank email re-renders the login page without a session' do
      params = valid_params
      params[:user][:email] = ''

      assert_no_difference('User.count') do
        post users_signup_url, params: params
      end

      assert_response :success
      assert_nil session[:current_user_id]
    end

    test 'mismatched password confirmation is rejected' do
      params = valid_params
      params[:user][:password_confirmation] = 'something else'

      assert_no_difference('User.count') do
        post users_signup_url, params: params
      end

      assert_response :success
      assert_nil session[:current_user_id]
      assert_no_difference(-> { Ahoy::Event.where(name: 'users:signed_up').count }) do
        post users_signup_url, params: params
      end
    end

    test 'requires agreeing to the terms when a terms url is configured' do
      with_signup_terms 'https://example.com/terms' do
        params = valid_params
        params[:user][:agreed] = '0'

        assert_no_difference('User.count') do
          post users_signup_url, params: params
        end

        assert_response :success
      end
    end
  end
end
