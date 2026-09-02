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
