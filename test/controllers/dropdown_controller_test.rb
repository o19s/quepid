# frozen_string_literal: true

require 'test_helper'

class DropdownControllerTest < ActionController::TestCase
  setup do
    # Doug has fixtures with tries so recent-cases links render real hrefs.
    login_user users(:doug)
  end

  test 'cases frame defaults to angular case links' do
    get :cases
    assert_response :success
    assert_not_includes @response.body, '/new_ui'
  end

  test 'cases frame with new_ui links to new_ui case URLs' do
    get :cases, params: { new_ui: 'true' }
    assert_response :success
    assert_includes @response.body, '/new_ui'
  end
end
