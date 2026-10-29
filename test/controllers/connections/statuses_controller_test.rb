# frozen_string_literal: true

require 'test_helper'

module Connections
  class StatusesControllerTest < ActionDispatch::IntegrationTest
    let(:member) { users(:random) }
    let(:connection) { connections(:openai) }
    let(:models_url) { 'https://api.openai.com/v1/models' }

    setup do
      login_user_for_integration_test member
    end

    test 'reports a connection that answers, using its own URL and saved key' do
      stub = stub_request(:get, models_url).with(headers: { 'Authorization' => 'Bearer sk-test-openai' }).to_return(status: 200, body: '{}')

      get connection_status_url(connection), as: :json

      assert_response :success
      assert_equal 'ok', response.parsed_body['status']
      assert_requested stub
    end

    test 'someone a connection is shared with can ask, though they cannot manage it' do
      assert_not connection.manageable_by?(member)
      stub_request(:get, models_url).to_return(status: 200, body: '{}')

      get connection_status_url(connection), as: :json

      assert_response :success
    end

    test 'reports a rejected key' do
      stub_request(:get, models_url).to_return(status: 401, body: '{}')

      get connection_status_url(connection), as: :json

      assert_equal 'rejected', response.parsed_body['status']
    end

    test 'reports a service that cannot be reached' do
      stub_request(:get, models_url).to_timeout

      get connection_status_url(connection), as: :json

      assert_response :success
      assert_equal 'unreachable', response.parsed_body['status']
    end

    test 'does not take a URL or key from the request' do
      stub = stub_request(:get, models_url).to_return(status: 200, body: '{}')

      get connection_status_url(connection), params: { connection: { base_url: 'https://evil.example', secret: 'x' } }, as: :json

      assert_requested stub
      assert_not_requested :get, /evil\.example/
    end

    test 'does not wait the connection\'s whole timeout' do
      connection.update!(timeout: 600)
      stub_request(:get, models_url).to_return(status: 200, body: '{}')
      timeouts = []
      original = Connection.instance_method(:check)
      Connection.define_method(:check) do
        timeouts << timeout
        original.bind_call(self)
      end

      begin
        get connection_status_url(connection), as: :json
      ensure
        Connection.define_method(:check, original)
      end

      assert_equal [ StatusesController::MAX_TIMEOUT ], timeouts
      assert_equal 600, connection.reload.timeout
    end

    test 'a connection the user cannot use is not found, and nothing is requested' do
      get connection_status_url(connections(:private_ollama)), as: :json

      assert_response :not_found
      assert_not_requested :get, /ollama/
    end

    test 'an instance-wide connection can be asked by anyone' do
      stub_request(:get, 'http://elasticsearch:9200').to_return(status: 200, body: '{}')

      get connection_status_url(connections(:instance_elasticsearch)), as: :json

      assert_response :success
      assert_equal 'ok', response.parsed_body['status']
    end
  end
end
