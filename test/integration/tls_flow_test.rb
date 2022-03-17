# frozen_string_literal: true

require 'test_helper'

class TlsFlowTest < ActionDispatch::IntegrationTest
  include ActionMailer::TestHelper

  test 'A https search url and http quepid requires redirecting to http quepid' do
    bootstrap_user = users(:bootstrap_user)

    post users_login_url params: { user: { email: bootstrap_user.email, password: 'password' }, format: :json }

    kase = users(:bootstrap_user).cases.first
    require 'pp'

    try_http = kase.tries.first

    assert_not try_http.search_url.starts_with?('https')

    try_https = kase.tries.second

    assert try_https.search_url.starts_with?('https')

    # Navigate to a try that is http TLS protocol
    get case_home_url(id: kase.id, try_number: try_http.try_number)
    assert_response :ok
    puts "Request ssl?  #{request.ssl?}"

    # Navigate to a try that is https TLS protocol
    # temp, remove me.
    # try_http.search_url="https://followme.com"
    # try_http.save!
    puts "here is my try: #{try_https.search_url}"
    get case_home_url(id: kase.id, try_number: try_https.try_number)
    assert_response :redirect
  end
end
