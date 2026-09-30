# frozen_string_literal: true

require 'test_helper'

class HomeControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:random) }

  test 'should get redirected to log in' do
    get root_url
    assert_response :redirect
  end

  describe 'announcements' do
    let(:user) { users(:random) }

    test 'shows a currently active announcement' do
      login_user_for_integration_test user

      get root_url

      assert_response :success
      assert_includes response.body, announcements(:active_announcement).text
    end

    test 'does not show an announcement that has expired' do
      # Only the expired announcement is unseen for this user in this test, so if
      # filtering failed we'd see it here.
      announcements(:active_announcement).announcement_viewed.create!(user: user)

      login_user_for_integration_test user

      get root_url

      assert_response :success
      assert_not_includes response.body, announcements(:expired_announcement).text
    end

    test 'does not show an announcement scheduled for the future' do
      announcements(:active_announcement).announcement_viewed.create!(user: user)

      login_user_for_integration_test user

      get root_url

      assert_response :success
      assert_not_includes response.body, announcements(:scheduled_announcement).text
    end
  end

  test 'does not show the cookie consent toast when no cookies_url is configured' do
    with_cookies_url nil do
      login_user_for_integration_test user

      get root_url

      assert_response :success
      assert_select '#consent_banner', count: 0
    end
  end

  test 'shows the cookie consent toast when a cookies_url is configured and not yet consented' do
    with_cookies_url 'https://example.com/cookies' do
      login_user_for_integration_test user

      get root_url

      assert_response :success
      assert_select '#consent_banner', count: 1
      assert_select "#consent_banner a[href='https://example.com/cookies']"
    end
  end

  test 'does not show the cookie consent toast once already consented' do
    with_cookies_url 'https://example.com/cookies' do
      login_user_for_integration_test user
      cookies['cookie_eu_consented'] = 'true'

      get root_url

      assert_response :success
      assert_select '#consent_banner', count: 0
    end
  end

  describe 'case_prophet' do
    let(:kase) { user.cases.create!(case_name: 'Prophet Case') }
    let(:case_try) { kase.tries.first || kase.tries.create!(try_number: 1, search_endpoint: search_endpoints(:one)) }

    def add_score value, at, annotation: nil
      Score.create!(case: kase, try: case_try, user: user, scorer: kase.scorer, score: value,
                    annotation: annotation, created_at: at, updated_at: at)
    end

    setup do
      Bullet.enable = false
      login_user_for_integration_test user
    end

    test 'renders no scores yet when the case has none' do
      get home_case_prophet_url(case_id: kase.id)

      assert_response :success
      assert_includes response.body, "case_frame_#{kase.id}"
      assert_includes response.body, 'no scores yet'
    end

    test 'renders with fewer than three scores without computing a changepoint' do
      add_score 0.5, 2.days.ago
      add_score 0.6, 1.day.ago

      get home_case_prophet_url(case_id: kase.id)

      assert_response :success
      assert_not_includes response.body, 'increase since'
      assert_not_includes response.body, 'decrease since'
    end

    test 'renders same-day scores' do
      now = Time.zone.now.change(hour: 12)
      add_score 0.1, now - 2.hours
      add_score 0.2, now - 1.hour
      add_score 0.3, now

      get home_case_prophet_url(case_id: kase.id)

      assert_response :success
      assert_includes response.body, "case_frame_#{kase.id}"
    end

    test 'renders multi-day scores' do
      add_score 0.1, 4.days.ago
      add_score 0.2, 3.days.ago
      add_score 0.3, 2.days.ago
      add_score 0.4, 1.day.ago

      get home_case_prophet_url(case_id: kase.id)

      assert_response :success
      assert_includes response.body, "case_frame_#{kase.id}"
    end

    test 'does not blow up when the score at the changepoint is zero' do
      add_score 0.0, 4.days.ago
      add_score 0.0, 3.days.ago
      add_score 0.5, 2.days.ago
      add_score 0.6, 1.day.ago

      get home_case_prophet_url(case_id: kase.id)

      assert_response :success
      assert_not_includes response.body, 'NaN'
      assert_not_includes response.body, 'Infinity'
    end

    test 'includes annotations' do
      add_score 0.1, 3.days.ago
      add_score 0.2, 2.days.ago
      annotation = Annotation.create!(user: user, message: 'tuned boosts')
      add_score 0.3, 1.day.ago, annotation: annotation

      get home_case_prophet_url(case_id: kase.id)

      assert_response :success
      assert_includes response.body, 'tuned boosts'
    end

    test 'returns not modified when the ETag matches' do
      add_score 0.1, 1.day.ago

      get home_case_prophet_url(case_id: kase.id)
      assert_response :success
      etag = response.headers['ETag']
      assert_not_nil etag

      get home_case_prophet_url(case_id: kase.id), headers: { 'If-None-Match' => etag }
      assert_response :not_modified
    end

    test 'returns not found for a missing case' do
      get home_case_prophet_url(case_id: 0)

      assert_response :not_found
    end

    test 'returns not found for a case the user cannot access' do
      get home_case_prophet_url(case_id: cases(:random_case).id)

      assert_response :not_found
    end
  end

  describe 'book_summary_detail' do
    let(:book) { books(:james_bond_movies) }

    setup do
      Bullet.enable = false
    end

    test 'renders counts for an accessible book' do
      login_user_for_integration_test book.owner

      get home_book_summary_detail_url(book_id: book.id)

      assert_response :success
      assert_includes response.body, "book_frame_#{book.id}"
      assert_includes response.body, "#{book.judgements.size} Judgements across #{book.query_doc_pairs.size} pairs"
    end

    test 'returns not modified when the ETag matches' do
      login_user_for_integration_test book.owner

      get home_book_summary_detail_url(book_id: book.id)
      etag = response.headers['ETag']
      assert_not_nil etag

      get home_book_summary_detail_url(book_id: book.id), headers: { 'If-None-Match' => etag }
      assert_response :not_modified
    end

    test 'returns not found for a missing book' do
      login_user_for_integration_test user

      get home_book_summary_detail_url(book_id: 0)

      assert_response :not_found
    end

    test 'returns not found for a book the user is not involved with' do
      other_book = Book.create!(name: 'Private Book', owner: users(:random_1), scale: '0,1')
      login_user_for_integration_test user

      get home_book_summary_detail_url(book_id: other_book.id)

      assert_response :not_found
    end
  end

  test 'can I group things' do
    case_names = [ 'Typeahead: Dairy', 'Typeahead: Meats', 'Typeahead: Dessert', 'Typeahead: Fruit & Veg',
                   'Global Search', 'Nested:Search:IsFun' ]

    grouped_names = case_names.group_by { |name| name.split(':').first }

    assert_not_nil grouped_names['Typeahead']
    assert_equal 4, grouped_names['Typeahead'].count
    assert_not_nil grouped_names['Global Search']
    assert_equal 1, grouped_names['Global Search'].count
    assert_not_nil grouped_names['Nested']
    assert_equal 1, grouped_names['Nested'].count
  end
end
