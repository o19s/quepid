# frozen_string_literal: true

require 'test_helper'

module Analytics
  module Cases
    class VisibilitiesControllerTest < ActionController::TestCase
      let(:user) { users(:random) }
      let(:kase) { cases(:case_with_score) } # owned by random

      setup do
        @controller = Analytics::Cases::VisibilitiesController.new
        login_user user
      end

      test 'makes a private case public and returns to the tries visualization' do
        kase.update!(public: false)

        patch :update, params: { case_id: kase.id }

        assert_redirected_to analytics_tries_visualization_path(kase)
        assert_predicate kase.reload, :public?
      end

      test 'makes a public case private' do
        kase.update!(public: true)

        patch :update, params: { case_id: kase.id }

        assert_redirected_to analytics_tries_visualization_path(kase)
        assert_not kase.reload.public?
      end

      test 'records the update as an analytics event' do
        expects_any_ga_event_call 'cases:updated_a_case'

        patch :update, params: { case_id: kase.id }

        assert_response :redirect
      end

      describe 'a case this user is not involved with' do
        let(:matt_case) { cases(:matt_case) } # owned by matt, not shared with random

        test 'does not change a private case' do
          matt_case.update!(public: false)

          patch :update, params: { case_id: matt_case.id }

          assert_response :not_found
          assert_not matt_case.reload.public?
        end

        test 'does not let a stranger make a public case private, since public access is read-only' do
          matt_case.update!(public: true)

          patch :update, params: { case_id: matt_case.id }

          assert_response :not_found
          assert_predicate matt_case.reload, :public?
        end
      end

      test 'sends an anonymous visitor to the login page and leaves the case unchanged' do
        @controller = Analytics::Cases::VisibilitiesController.new # a fresh instance has no login
        kase.update!(public: false)

        patch :update, params: { case_id: kase.id }

        assert_redirected_to new_session_path
        assert_not kase.reload.public?
      end
    end
  end
end
