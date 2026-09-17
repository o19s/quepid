# frozen_string_literal: true

require 'test_helper'

class LegacyRouteRedirectsTest < ActionDispatch::IntegrationTest
  test 'GET /users/sign_in redirects to the actual sign in page instead of 404ing' do
    get '/users/sign_in'

    assert_redirected_to '/login'
  end

  # The redirect target has to stay relative ('login', not '/login'): ActionDispatch only prepends
  # SCRIPT_NAME for relative paths, so a leading slash sends subpath deployments to a 404 while
  # looking perfectly fine at the root mount.
  test 'GET /users/sign_in keeps the mount prefix under a subpath deployment' do
    get '/users/sign_in', env: { 'SCRIPT_NAME' => '/quepid-app' }

    assert_redirected_to '/quepid-app/login'
  end
end
