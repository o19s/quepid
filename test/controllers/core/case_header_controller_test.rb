# frozen_string_literal: true

require 'test_helper'

module Core
  class CaseHeaderControllerTest < ActionDispatch::IntegrationTest
    let(:user)  { users(:doug) }
    let(:kase)  { cases(:one) }
    let(:a_try) { tries(:one) }

    before do
      login_user_for_integration_test user
    end

    describe '#show' do
      test 'renders the header for a case the user can reach' do
        get case_header_path(kase)

        assert_response :success
        assert_match kase.case_name, response.body
      end

      test 'renders the requested try rather than the latest' do
        get case_header_path(kase, try_number: a_try.try_number)

        assert_response :success
        assert_match a_try.formatted_name, response.body
      end

      test 'is not found for a case the user is not involved with' do
        login_user_for_integration_test users(:random)

        get case_header_path(kase)

        assert_response :not_found
      end
    end

    describe '#rename_case' do
      test 'renames the case and renders the header with the new name' do
        patch rename_case_header_path(kase), params: { case: { case_name: 'Renamed Case' } }

        assert_response :success
        assert_equal 'Renamed Case', kase.reload.case_name
        assert_match 'Renamed Case', response.body
      end

      test 'strips surrounding whitespace from the new name' do
        patch rename_case_header_path(kase), params: { case: { case_name: '  Padded  ' } }

        assert_response :success
        assert_equal 'Padded', kase.reload.case_name
      end

      # The Rename button is disabled client-side for a blank name; this is the server guard
      # behind it, and it must not blank out a real case name.
      test 'rejects a blank name without changing the case' do
        original = kase.case_name

        patch rename_case_header_path(kase), params: { case: { case_name: '   ' } }

        assert_response :unprocessable_content
        assert_equal original, kase.reload.case_name
        assert_match 'Case name cannot be blank', response.body
      end

      test 'is not found for a case the user is not involved with' do
        login_user_for_integration_test users(:random)
        original = kase.case_name

        patch rename_case_header_path(kase), params: { case: { case_name: 'Hijacked' } }

        assert_response :not_found
        assert_equal original, kase.reload.case_name
      end
    end

    describe '#rename_try' do
      test 'renames the try and renders its formatted name' do
        patch rename_try_header_path(kase, a_try.try_number), params: { try: { name: 'Baseline' } }

        assert_response :success
        assert_equal 'Baseline', a_try.reload.name
        assert_match "Baseline - Try #{a_try.try_number}", response.body
      end

      test 'rejects a blank try name without changing the try' do
        a_try.update! name: 'Baseline'

        patch rename_try_header_path(kase, a_try.try_number), params: { try: { name: '' } }

        assert_response :unprocessable_content
        assert_equal 'Baseline', a_try.reload.name
        assert_match 'Try name cannot be blank', response.body
      end
    end
  end
end
