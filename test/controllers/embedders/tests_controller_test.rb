# frozen_string_literal: true

require 'test_helper'

module Embedders
  class TestsControllerTest < ActionDispatch::IntegrationTest
    let(:user) { users(:random) }
    let(:embedder) { embedders(:openai_small) }

    setup do
      login_user_for_integration_test user
    end

    def stub_openai key
      stub_request(:post, 'https://api.openai.com/v1/embeddings')
        .with(headers: { 'Authorization' => "Bearer #{key}" })
        .to_return(status: 200, headers: { 'Content-Type' => 'application/json' },
                   body: { data: [ { index: 0, embedding: Array.new(512) { |i| i / 512.0 } } ] }.to_json)
    end

    test 'embeds a sample with unsaved form values' do
      stub = stub_openai('sk-typed')

      post embedder_test_url('new'), params: {
        text:     'star wars',
        embedder: { provider: 'openai', service_url: 'https://api.openai.com', model: 'text-embedding-3-small',
                    api_key: 'sk-typed', truncation: 'native', dimensions: '512', timeout: '30' },
      }

      assert_response :success
      assert_requested stub
      body = response.parsed_body
      assert_equal 512, body['dimensions']
      assert_equal 5, body['preview'].size
      assert_equal 'star wars', body['input']
    end

    test 'a saved embedder with a blank key is tested with its saved key' do
      stub = stub_openai('sk-test-openai')

      post embedder_test_url(embedder), params: {
        embedder: { provider: 'openai', service_url: embedder.service_url, model: embedder.model, api_key: '',
                    truncation: 'native', dimensions: '512', timeout: '30' },
      }

      assert_response :success
      assert_requested stub
    end

    test 'reports invalid settings without calling out' do
      post embedder_test_url('new'), params: { embedder: { provider: 'openai', service_url: '', model: '' } }

      assert_response :unprocessable_content
      assert_match(/Service url/, response.parsed_body['error'])
    end

    test 'reports a provider error' do
      stub_request(:post, 'https://api.openai.com/v1/embeddings')
        .to_return(status: 500, body: 'boom')

      post embedder_test_url('new'), params: {
        embedder: { provider: 'openai', service_url: 'https://api.openai.com', model: 'm', timeout: '30' },
      }

      assert_response :bad_gateway
      assert_match(/500/, response.parsed_body['error'])
    end
  end
end
