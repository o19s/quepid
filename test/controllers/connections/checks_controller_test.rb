# frozen_string_literal: true

require 'test_helper'

module Connections
  class ChecksControllerTest < ActionDispatch::IntegrationTest
    let(:owner) { users(:doug) }
    let(:member) { users(:random) }
    let(:connection) { connections(:openai) }
    let(:models_url) { 'https://api.openai.com/v1/models' }

    def form_params overrides = {}
      { name: 'x', service: 'openai', base_url: 'https://api.openai.com', auth_scheme: 'bearer', secret: 'sk-typed', timeout: '30' }.merge(overrides)
    end

    test 'checks the unsaved form with the secret typed into it' do
      login_user_for_integration_test member
      stub = stub_request(:get, models_url).with(headers: { 'Authorization' => 'Bearer sk-typed' }).to_return(status: 200, body: '{}')

      post check_connections_url, params: { connection: form_params }, as: :json

      assert_response :success
      assert_equal 'ok', response.parsed_body['status']
      assert_requested stub
    end

    test 'reports a rejected key' do
      login_user_for_integration_test member
      stub_request(:get, models_url).to_return(status: 401, body: '{}')

      post check_connections_url, params: { connection: form_params }, as: :json

      assert_equal 'rejected', response.parsed_body['status']
    end

    test 'reports an invalid form without calling the service' do
      login_user_for_integration_test member

      post check_connections_url, params: { connection: form_params(base_url: 'nope') }, as: :json

      assert_response :unprocessable_content
      assert_match(/URL/, response.parsed_body['error'])
      assert_not_requested :get, models_url
    end

    test 'the owner can check a saved connection with its saved secret' do
      login_user_for_integration_test owner
      stub = stub_request(:get, models_url).with(headers: { 'Authorization' => 'Bearer sk-test-openai' }).to_return(status: 200, body: '{}')

      post connection_check_url(connection), params: { connection: form_params(secret: '') }, as: :json

      assert_response :success
      assert_requested stub
    end

    test 'a team member cannot borrow the saved secret by checking someone else\'s connection' do
      login_user_for_integration_test member

      post connection_check_url(connection), params: { connection: form_params(base_url: 'https://evil.example', secret: '') }, as: :json

      assert_response :not_found
      assert_not_requested :get, /evil\.example/
    end
  end
end
