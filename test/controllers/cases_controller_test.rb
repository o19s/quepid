# frozen_string_literal: true

require 'test_helper'

class CasesControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:random) }

  setup do
    login_user_for_integration_test user
  end

  test 'index renders body with data-quepid-root-url for Stimulus navigation' do
    Bullet.enable = false
    get cases_url
    Bullet.enable = true

    assert_response :success
    expected_root = root_url.chomp('/')
    assert_select 'body[data-quepid-root-url=?]', expected_root
    assert_select '[data-controller="import-case"]#importCaseModal'
  end

  test 'destroy permanently deletes a case the user owns and redirects to the cases listing' do
    kase = cases(:queries_case)

    Bullet.enable = false
    assert_difference('Case.count', -1) do
      delete case_url(kase)
    end
    Bullet.enable = true

    assert_redirected_to cases_path
    assert_nil Case.find_by(id: kase.id)
  end

  test 'destroy does not delete a case the user is not involved with' do
    kase = cases(:owned_case)

    assert_no_difference('Case.count') do
      delete case_url(kase)
    end

    assert_redirected_to cases_path
    assert_not_nil Case.find_by(id: kase.id)
  end

  test 'destroy_queries deletes all queries for the case but keeps the case' do
    kase = cases(:queries_case)

    Bullet.enable = false
    assert_difference('kase.queries.count', -kase.queries.count) do
      delete case_queries_url(kase)
    end
    Bullet.enable = true

    assert_redirected_to case_core_path(id: kase.id, try_number: kase.last_try_number)
    assert_not_nil Case.find_by(id: kase.id)
  end

  test 'destroy_queries does not delete queries for a case the user is not involved with' do
    kase = cases(:owned_case)

    delete case_queries_url(kase)

    assert_redirected_to cases_path
  end

  test 'archive marks a case the user owns as archived and redirects to the cases listing' do
    kase = cases(:queries_case)

    post archive_case_url(kase)

    assert_redirected_to cases_path
    assert kase.reload.archived
    assert_equal user, kase.owner
  end

  test 'archive does not archive a case the user is not involved with' do
    kase = cases(:owned_case)

    post archive_case_url(kase)

    assert_redirected_to cases_path
    assert_not kase.reload.archived
  end
end
