# frozen_string_literal: true

require 'test_helper'

class DropdownControllerTest < ActionController::TestCase
  setup do
    # Doug has fixtures with tries so recent-cases links render real hrefs.
    login_user users(:doug)
  end

  test 'cases frame renders case links' do
    get :cases
    assert_response :success
    assert_includes @response.body, '/case/'
  end
end
