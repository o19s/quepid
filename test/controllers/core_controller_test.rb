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
  end
end
