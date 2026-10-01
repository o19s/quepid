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

  describe 'filtering with q' do
    let(:rated_query) { @case.queries.first || @case.queries.create!(query_text: 'filter query') }

    setup do
      login_user_for_integration_test user
      rated_query.ratings.create!(doc_id: 'zero_rated_doc', rating: 0)
      rated_query.ratings.create!(doc_id: 'three_rated_doc', rating: 3)
    end

    test 'text that is not a number does not match every rating of zero' do
      get case_ratings_url(@case, q: 'nothingmatchesthis')

      assert_response :success
      assert_not_includes response.body, 'zero_rated_doc'
      assert_not_includes response.body, 'three_rated_doc'
    end

    test 'matches doc ids and numeric ratings' do
      get case_ratings_url(@case, q: 'three_rated')

      assert_includes response.body, 'three_rated_doc'
      assert_not_includes response.body, 'zero_rated_doc'

      get case_ratings_url(@case, q: '3')

      assert_includes response.body, 'three_rated_doc'
    end
  end
end
