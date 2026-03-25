# frozen_string_literal: true

require 'test_helper'

class CoreControllerTest < ActionController::TestCase
  before do
    @controller = CoreController.new
  end

  describe 'index' do
    before do
      login_user users(:doug)
    end

    test 'should get index' do
      get :index
      assert_response :success
    end

    test 'should get index with case and try' do
      the_case = cases(:one)
      the_try = tries(:one)

      get :index, params: { id: the_case.id, try_number: the_try.try_number }
      assert_response :success
    end

    test 'uses core layout with importmap tags' do
      the_case = cases(:one)
      the_try = tries(:one)

      get :index, params: { id: the_case.id, try_number: the_try.try_number }

      assert_select 'script[type="importmap"]'
      assert_select 'link[rel="stylesheet"][href*="core"]'
    end

    test 'renders case header and query list' do
      the_case = cases(:one)
      the_try = tries(:one)

      get :index, params: { id: the_case.id, try_number: the_try.try_number }

      assert_select '#query-list-shell'
      assert_select '[data-controller="query-list"]'
      assert_select '[data-controller="case-score"]'
      assert_select '[data-controller="inline-edit"]'
    end

    test 'sets data attributes on body' do
      the_case = cases(:one)
      the_try = tries(:one)

      get :index, params: { id: the_case.id, try_number: the_try.try_number }

      assert_select "body[data-try-number='#{the_try.try_number}']"
      assert_select "body[data-case-id='#{the_case.id}']"
    end

    test 'uses BS5 navbar' do
      the_case = cases(:one)
      the_try = tries(:one)

      get :index, params: { id: the_case.id, try_number: the_try.try_number }

      assert_select 'nav.navbar.navbar-expand-lg.navbar-secondary'
      assert_select 'header#header.navbar-inverse', count: 0
    end
  end
end
