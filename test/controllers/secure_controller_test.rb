# frozen_string_literal: true

require 'test_helper'

class SecureControllerTest < ActionController::TestCase
  test 'get index' do
    get :index
    assert_response :success
  end
end
