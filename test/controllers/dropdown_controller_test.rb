# frozen_string_literal: true

require 'test_helper'

class DropdownControllerTest < ActionController::TestCase
  before do
    @controller = DropdownController.new
  end

  describe 'Basic functionality' do
    before do
      login_user users(:doug)
    end

    test 'should get cases' do
      get :cases
      assert_response :success
    end

    test 'should get books' do
      get :books
      assert_response :success
    end

    # Regression: these links used to do a Turbo AJAX visit ("_top") on the core case page,
    # which swaps <body> without reloading the script context - Angular kept running against the
    # old case while the URL silently changed underneath it. Both `data-turbo="false"` (escapes
    # Turbo, which otherwise stays frame-navigable even with Drive off) and `target="_self"`
    # (escapes AngularJS's own $locationProvider.html5Mode link rewriter) are required together;
    # either alone still leaves the click intercepted. See app/views/dropdown/cases_core.html.erb.
    test 'cases_core links force a hard navigation, unlike the Rails-page #cases links' do
      get :cases_core
      assert_response :success
      assert_select 'turbo-frame#dropdown_cases a[data-turbo="false"][target="_self"]', minimum: 1

      get :cases
      assert_response :success
      assert_select 'turbo-frame#dropdown_cases a[data-turbo="false"]', count: 0
    end

    test 'books_core links force a hard navigation, unlike the Rails-page #books links' do
      get :books_core
      assert_response :success
      assert_select 'turbo-frame#dropdown_books a[data-turbo="false"][target="_self"]', minimum: 1

      get :books
      assert_response :success
      assert_select 'turbo-frame#dropdown_books a[data-turbo="false"]', count: 0
    end
  end
end
