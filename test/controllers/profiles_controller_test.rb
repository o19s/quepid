# frozen_string_literal: true

require 'test_helper'

class ProfilesControllerTest < ActionController::TestCase
  let(:user) { users(:random) }

  before do
    @controller = ProfilesController.new
  end

  describe 'updates profile' do
    describe 'when user is not signed in' do
      test 'returns an unauthorized error' do
        patch :update, params: { user: { name: 'new name' } }

        assert_redirected_to secure_path
      end
    end

    describe 'when user is signed in' do
      before do
        login_user user
      end

      test 'updates user name' do
        name = 'new name'

        patch :update, params: { user: { name: name } }

        assert_redirected_to profile_path

        assert_equal user.name, name
      end

      it 'updates user email' do
        email = 'new@email.com'

        patch :update, params: { user: { email: email } }

        assert_redirected_to profile_path

        assert_equal user.email, email
      end

      describe 'analytics' do
        test 'posts event' do
          expects_any_ga_event_call

          name = 'new name'

          perform_enqueued_jobs do
            patch :update, params: { user: { name: name } }

            assert_redirected_to profile_path
          end
        end
      end
    end
  end
end
