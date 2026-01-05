# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    class SignupsControllerTest < ActionController::TestCase
      let(:user) { users(:matt) }
      before do
        @controller = Api::V1::SignupsController.new
      end

      describe 'Creates new user' do
        test 'returns an error when the email is not present' do
          data = { user: { password: 'password' } }

          post :create, params: data

          assert_response :bad_request

          error = response.parsed_body
          assert_includes error['email'], I18n.t('errors.messages.blank')
        end

        test 'returns an error when the email is not unique' do
          data = { user: { email: users(:doug).email, password: 'password' } }

          post :create, params: data

          assert_response :bad_request

          error = response.parsed_body
          assert_includes error['email'], I18n.t('errors.messages.taken')
        end

        test 'user with existing invite is allowed to signup using invite user record and doesnt create a case' do
          invitee = User.invite!({ email: 'invitee@mail.com', password: '' }, user)
          assert_predicate invitee, :created_by_invite?

          data = { user: { email: invitee.email, password: 'password' } }

          post :create, params: data
          assert_response :ok

          invitee.reload
          assert_empty invitee.cases
        end

        test 'returns an error when the password is not present' do
          data = { user: { email: 'foo@example.com' } }

          post :create, params: data

          assert_response :bad_request

          error = response.parsed_body
          assert_includes error['password'], I18n.t('errors.messages.blank')
        end

        test 'returns an error when the agreed is false' do
          data = { user: { email: 'foo@example.com', password: 'password2', agreed: false } }

          post :create, params: data

          assert_response :bad_request

          error = response.parsed_body
          assert_includes error['agreed'], 'checkbox must be clicked to signify you agree to the terms and conditions.'
        end

        test 'encrypts the password' do
          password = 'password'
          data = { user: { email: 'foo@example.com', password: password } }

          post :create, params: data

          assert_response :ok

          user = User.find_by(email: 'foo@example.com')

          assert_not_equal password, user.password
          assert_equal BCrypt::Password.new(user.password), password
        end

        test 'sets the defaults, which no longer includes a Case' do
          password = 'password'
          data = { user: { email: 'foo@example.com', password: password } }

          post :create, params: data

          assert_response :ok

          user = User.find_by(email: 'foo@example.com')

          assert_not_nil user.completed_case_wizard
          assert_not_nil user.num_logins

          assert_not user.completed_case_wizard
          assert_equal 0, user.num_logins

          assert_equal 0, user.cases.count
        end

        test 'does not care if the name is present' do
          password = 'password'
          data = { user: { email: 'foo@example.com', password: password } }

          assert_difference 'User.count' do
            post :create, params: data

            assert_response :ok
          end
        end

        test 'sets the name if present' do
          password = 'password'
          name     = 'First'

          data = {
            user: {
              email:    'foo@example.com',
              password: password,
              name:     name,
            },
          }

          assert_difference 'User.count' do
            post :create, params: data

            assert_response :ok

            user = User.last

            assert_equal name, user.name
          end
        end
      end

      describe 'verify email marketing mode logic' do
        test 'accepts no email marketing field' do
          password = 'password'
          data = { user: { email: 'foo@example.com', password: password }, format: :json }

          post :create, params: data
          assert_response :ok

          user = User.last
          assert_not user.email_marketing
        end

        test 'unchecked sets email_marketing to false' do
          password = 'password'
          data = { user: { email: 'foo@example.com', password: password, email_marketing: false } }

          post :create, params: data
          assert_response :ok

          user = User.last
          assert_not user.email_marketing
        end

        test 'checked sets email_marketing to true' do
          password = 'password'
          data = { user: { email: 'foo@example.com', password: password, email_marketing: true } }

          post :create, params: data
          assert_response :ok

          user = User.last
          assert user.email_marketing
        end
      end

      describe 'analytics' do
        test 'creates user and posts an event' do
          expects_any_ga_event_call

          password = 'password'
          data = { user: { email: 'foo@example.com', password: password } }

          perform_enqueued_jobs do
            post :create, params: data

            assert_response :ok
          end
        end
      end
    end
  end
end
