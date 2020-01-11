# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    class SignupsControllerTest < ActionController::TestCase
      before do
        @controller = Api::V1::SignupsController.new
      end

      describe 'Creates new user' do
        test 'returns an error when the username is not present' do
          data = { user: { password: 'password' } }

          post :create, data

          assert_response :bad_request

          error = JSON.parse(response.body)
          assert_includes error['username'], I18n.t('errors.messages.blank')
        end

        test 'returns an error when the username is not unique' do
          data = { user: { username: users(:doug).username, password: 'password' } }

          post :create, data

          assert_response :bad_request

          error = JSON.parse(response.body)
          assert_includes error['username'], I18n.t('errors.messages.taken')
        end

        test 'returns an error when the email is not present' do
          data = { user: { username: 'foo' } }

          post :create, data

          assert_response :bad_request

          error = JSON.parse(response.body)
          assert_includes error['password'], I18n.t('errors.messages.blank')
        end

        test 'encrypts the password' do
          password = 'password'
          data = { user: { username: 'foo', password: password } }

          post :create, data

          assert_response :ok

          user = User.find_by(username: 'foo')

          assert_not_equal password, user.password
          assert BCrypt::Password.new(user.password) == password
        end

        test 'sets the defaults' do
          password = 'password'
          data = { user: { username: 'foo', password: password } }

          post :create, data

          assert_response :ok

          user = User.find_by(username: 'foo')

          assert_not_nil user.first_login
          assert_not_nil user.num_logins

          assert_equal true,  user.first_login
          assert_equal 0,     user.num_logins
        end

        test 'does not care if the name is present' do
          password = 'password'
          data = { user: { username: 'foo', password: password } }

          assert_difference 'User.count' do
            post :create, data

            assert_response :ok
          end
        end

        test 'sets the name if present' do
          password = 'password'
          name     = 'First'

          data = {
            user: {
              username: 'foo',
              password: password,
              name:     name,
            },
          }

          assert_difference 'User.count' do
            post :create, data

            assert_response :ok

            user = User.last

            assert_equal name, user.name
          end
        end
      end

      describe 'analytics' do
        test 'creates user and posts an event' do
          expects_any_ga_event_call

          password = 'password'
          data = { user: { username: 'foo', password: password } }

          perform_enqueued_jobs do
            post :create, data

            assert_response :ok
          end
        end
      end
    end
  end
end
