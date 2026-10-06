# frozen_string_literal: true

require 'test_helper'

# Exercise the engine independently of the host's AdminConstraint.
class RailsPulseAuthorizationTest < ActionController::TestCase
  include Devise::Test::ControllerHelpers

  tests RailsPulse::DashboardController

  setup do
    @routes = RailsPulse::Engine.routes
    @authentication_enabled = RailsPulse.configuration.authentication_enabled
    # Production enables this hook; the router gates development/test requests.
    RailsPulse.configuration.authentication_enabled = true
  end

  teardown do
    RailsPulse.configuration.authentication_enabled = @authentication_enabled
  end

  test 'engine denies an anonymous session' do
    get :index

    assert_response :forbidden
  end

  test 'engine denies an ordinary user session' do
    session[:current_user_id] = users(:random).id
    get :index

    assert_response :forbidden
  end

  test 'engine allows an administrator session' do
    session[:current_user_id] = users(:admin).id
    get :index

    assert_response :success
  end
end
