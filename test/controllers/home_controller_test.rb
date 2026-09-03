# frozen_string_literal: true

require 'test_helper'

class HomeControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:random) }

  test 'should get redirected to log in' do
    get root_url
    assert_response :redirect
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
