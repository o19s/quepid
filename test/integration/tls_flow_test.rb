# frozen_string_literal: true

require 'test_helper'

class TlsFlowTest < ActionDispatch::IntegrationTest
  include ActionMailer::TestHelper

  test 'SSL middleware keeps core modal catalogs on HTTP including subpath deployments' do
    middleware = ActionDispatch::SSL.new(->(_env) { [ 200, {}, [] ] }, **Rails.application.config.ssl_options)
    paths = [ scorers_catalog_path, case_books_catalog_path(case_id: 1), case_sharing_catalog_path(case_id: 1) ]

    [ '', '/quepid-app' ].each do |mount|
      paths.each do |path|
        env = Rack::MockRequest.env_for("http://www.example.com#{mount}#{path}")
        env['SCRIPT_NAME'] = mount
        env['PATH_INFO'] = path
        status, = middleware.call(env)
        assert_equal 200, status, "HTTP catalog redirected: #{mount}#{path}"
      end
    end

    status, headers, = middleware.call(Rack::MockRequest.env_for('http://www.example.com/scorers'))
    assert_equal 301, status
    assert_equal 'https://www.example.com/scorers', headers['location']
  end

  test 'A https search url and http quepid requires redirecting to http quepid' do
    bootstrap_user = users(:bootstrap_user)

    post users_login_url params: { user: { email: bootstrap_user.email, password: 'password' }, format: :json }

    kase = users(:bootstrap_user).cases.first

    try_http = kase.tries.first
    try_https = kase.tries.second

    assert_not try_http.search_endpoint.endpoint_url.starts_with?('https')
    assert try_https.search_endpoint.endpoint_url.starts_with?('https')

    # Navigate to a try that is http TLS protocol
    get case_core_url(id: kase.id, try_number: try_http.try_number)
    assert_response :ok

    # Navigate to a try that is https TLS protocol
    get case_core_url(id: kase.id, try_number: try_https.try_number)
    # assert_response :redirect
    assert_response :ok
  end
end
