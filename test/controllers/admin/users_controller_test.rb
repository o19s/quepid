# frozen_string_literal: true

require 'test_helper'

module Admin
  class UsersControllerTest < ActionController::TestCase
    let(:user) { users(:doug) }

    setup do
      @controller = Admin::UsersController.new
      login_user user
    end

    test 'should get index' do
      get :index

      assert_response :success

      assert_not_nil assigns(:users)
    end

    test 'an authorized user should NOT gain access' do
      user = users(:random)
      login_user user

      get :index

      assert_redirected_to root_path
    end

    test 'should show user' do
      get :show, params: { id: user }

      assert_response :success
      assert_equal user, assigns(:user)
    end
    test 'should get edit' do
      get :edit, params: { id: user }

      assert_response :success
      assert_equal user, assigns(:user)
    end

    test 'should update user' do
      patch :update, params: { id: user, user: { email: 'blah@blah.com' } }

      assert_redirected_to admin_user_path(assigns(:user))

      user.reload
      assert_equal 'blah@blah.com', user.email
    end

    describe 'analytics' do
      test 'posts event' do
        expects_any_ga_event_call

        perform_enqueued_jobs do
          patch :update, params: { id: user, user: { email: 'blah@blah.com' } }

          assert_redirected_to admin_user_path(assigns(:user))
        end
      end
    end
  end
end
