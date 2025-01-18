# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    class CurrentUserControllerTest < ActionController::TestCase
      let(:matt) { users(:matt) }

      before do
        @controller = Api::V1::CurrentUserController.new
      end

      describe 'fetches current user' do
        describe 'when user is signed in' do
          before do
            login_user matt
          end

          test 'returns basic user info' do
            get :show
            assert_response :ok

            body = response.parsed_body

            assert body['email'] == matt.email
            assert body['administrator'] == matt.administrator?
          end
        end

        describe 'when user is not signed in' do
          test 'returns an unauthorized error' do
            get :show
            assert_response :unauthorized
          end
        end
      end

      describe 'locked user' do
        let(:user) { users(:locked_user) }

        before do
          login_user user
        end

        describe 'already logged in user' do
          it 'checks the user is already loged in' do
            assert_equal user.id, @controller.send(:current_user).id
          end

          it 'logs user out and returns nil' do
            get :show

            assert_response :unauthorized
            assert_nil @controller.send(:current_user)
            assert_nil session[:current_user_id]
          end
        end
      end
    end
  end
end
