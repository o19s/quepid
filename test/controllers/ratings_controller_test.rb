# frozen_string_literal: true

require 'test_helper'

class RatingsControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:random) }
  setup do
    @case = cases(:import_ratings_case)
  end

  test 'should get index' do
    # get the login page

    get case_ratings_url(@case)
    assert_equal 302, status
    follow_redirect!

    login_user_for_integration_test user
    get case_ratings_url(@case)
    assert_response :success
  end
end
