# frozen_string_literal: true

require 'test_helper'

class CoreControllerTest < ActionController::TestCase
  before do
    @controller = CoreController.new
  end

  describe 'Basic functionality' do
    before do
      login_user users(:doug)
    end

    test 'should get index' do
      get :index
      assert_response :success
    end

    test 'should get show with case and try (modern workspace)' do
      kase = cases(:one)
      tr = tries(:one)
      get :show, params: { id: kase.id, try_number: tr.try_number }
      assert_response :success
      assert_select '#main-content[data-controller="workspace"]'
      assert_select '.core-workspace'
      assert_match kase.case_name, response.body
    end

    test 'show redirects to cases when case not found' do
      get :show, params: { id: 0 }
      assert_redirected_to cases_path
    end
  end
end
