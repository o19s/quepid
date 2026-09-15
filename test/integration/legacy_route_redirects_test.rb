# frozen_string_literal: true

require 'test_helper'

class LegacyRouteRedirectsTest < ActionDispatch::IntegrationTest
  test 'GET /users/sign_in redirects to the actual sign in page instead of 404ing' do
    get '/users/sign_in'

    assert_redirected_to '/login'
  end
end
