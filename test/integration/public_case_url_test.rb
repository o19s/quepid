# frozen_string_literal: true

require 'test_helper'

class PublicCaseUrlTest < ActionDispatch::IntegrationTest
  include ActionMailer::TestHelper

  test 'a regular case generates a encrypted url that is then used in the future ' do
    bootstrap_user = users(:bootstrap_user)

    post users_login_url params: { user: { email: bootstrap_user.email, password: 'password' }, format: :json }

    kase = users(:bootstrap_user).cases.first

    kase.mark_public!

    # Navigate to the case using bog standard Rails case_id=number
    get analytics_tries_visualization_url(case_id: kase.id)
    assert_response :ok

    # log out of Quepid (which prompts a redirect to log back in)
    get logout_url
    assert_response :redirect

    # We don't have access to the case as logged out user
  rescue NoMethodError do
           get analytics_tries_visualization_url(case_id: kase.id)
           raise "shouldn't have made it to here"
         end

    # assert_raises NoMethodError do
    #  get analytics_tries_visualization_url(case_id: kase.id)
    # end

    # Navigate to the case using the encrypted "public" version of the case id
    get analytics_tries_visualization_url(case_id: kase.public_id)
    assert_response :ok
  end
end
