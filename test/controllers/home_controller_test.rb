# frozen_string_literal: true

require 'test_helper'

class HomeControllerTest < ActionDispatch::IntegrationTest
  test 'should get redirected to log in' do
    get root_url
    assert_response :redirect
  end
end
