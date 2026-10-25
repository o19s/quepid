# frozen_string_literal: true

require 'test_helper'

class TryDeletionFlowTest < ActionDispatch::IntegrationTest
  setup do
    user = users(:joey)
    post users_login_url, params: { user: { email: user.email, password: 'password' }, format: :json }
    assert_response :ok
    @case = cases(:case_with_two_tries)
  end

  test 'deleting the latest try preserves core bootstrap and scoring' do
    delete api_case_try_url(@case, @case.last_try_number)
    assert_response :no_content

    assert_equal 1, @case.reload.last_try_number
    get case_core_url(@case)
    assert_response :ok
    assert_select 'body[data-core-bootstrap-try-no-value="1"]'

    get api_case_url(@case)
    assert_response :ok
    bootstrap = response.parsed_body
    assert_equal 1, bootstrap['last_try_number']
    assert_includes bootstrap['tries'].pluck('try_number'), bootstrap['last_try_number']

    put api_case_scores_url(@case), params: {
      case_score: { score: 0.8, try_number: bootstrap['last_try_number'] },
    }, as: :json
    assert_response :ok
    assert_equal @case.tries.find_by!(try_number: 1).id, response.parsed_body['try_id']

    post api_case_tries_url(@case), params: { try: { name: 'Replacement try' } }, as: :json
    assert_response :ok
    assert_equal 2, @case.reload.last_try_number
    assert_equal 2, @case.tries.maximum(:try_number)
  end

  test 'deleting an older try preserves the latest try number' do
    delete api_case_try_url(@case, 1)
    assert_response :no_content
    assert_equal 2, @case.reload.last_try_number
  end

  test 'the only try cannot be deleted' do
    kase = cases(:case_with_one_try)
    assert_no_difference 'kase.tries.count' do
      delete api_case_try_url(kase, 1)
    end
    assert_response :bad_request
    assert_equal 'Cannot delete the only try in a case.', response.parsed_body['error']
    assert_equal 1, kase.reload.last_try_number
  end
end
