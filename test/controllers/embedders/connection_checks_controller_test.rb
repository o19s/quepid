# frozen_string_literal: true

require 'test_helper'

module Embedders
  class ConnectionChecksControllerTest < ActionDispatch::IntegrationTest
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

    test 'embeds a sample with unsaved form values on an owned connection' do
      connections(:openai).update!(owner: user)
      stub = stub_openai('sk-test-openai')

      post connection_check_embedders_url, params: {
        text:     'star wars',
        embedder: { connection_id: connections(:openai).id, model: 'text-embedding-3-small',
                    truncation: 'native', dimensions: '512' },
      }

      assert_response :success
      assert_requested stub
      body = response.parsed_body
      assert_equal 512, body['dimensions']
      assert_equal 5, body['preview'].size
      assert_equal 'star wars', body['input']
    end

    test 'a saved embedder is tested with its connection\'s key' do
      stub = stub_openai('sk-test-openai')

      post embedder_connection_check_url(embedder), params: {
        embedder: { model: embedder.model, truncation: 'native', dimensions: '512' },
      }

      assert_response :success
      assert_requested stub
    end

    test 'checks a shared embedder without access to its private connection' do
      assert_not_includes user.connections_involved_with, connections(:openai)
      stub = stub_openai('sk-test-openai')
      original_attributes = embedder.attributes

      post embedder_connection_check_url(embedder), params: {
        text:     'unsaved sample',
        embedder: { connection_id: embedder.connection_id, name: 'Unsaved name', model: 'unsaved-model',
                    truncation: 'native', dimensions: '512' },
      }

      assert_response :success
      assert_requested stub
      assert_equal 'unsaved sample', response.parsed_body['input']
      assert_equal original_attributes, embedder.reload.attributes
    end

    test 'a saved embedder cannot switch its check to an inaccessible connection' do
      replacement = connections(:openai).dup.tap(&:save!)
      stub = stub_request(:post, 'https://api.openai.com/v1/embeddings')

      post embedder_connection_check_url(embedder), params: {
        embedder: { connection_id: replacement.id, model: 'm' },
      }

      assert_response :unprocessable_content
      assert_match(/isn't one you can use/, response.parsed_body['error'])
      assert_not_requested stub
      assert_equal connections(:openai).id, embedder.reload.connection_id
    end

    test 'an embedder the user cannot see is not found' do
      post embedder_connection_check_url(embedders(:private_ollama)), params: {
        embedder: { provider: 'ollama', model: 'all-minilm' },
      }

      assert_response :not_found
    end

    test 'a new embedder without a connection is refused before calling out' do
      post connection_check_embedders_url, params: {
        embedder: { provider: 'openai', model: 'm' },
      }

      assert_response :unprocessable_content
      assert_match(/Connection is required/, response.parsed_body['error'])
    end

    test 'reports invalid settings without calling out' do
      post connection_check_embedders_url, params: {
        embedder: { connection_id: connections(:openai).id, model: '', truncation: 'none' },
      }

      assert_response :unprocessable_content
      assert_match(/Model/, response.parsed_body['error'])
    end

    test 'reports a provider error' do
      connections(:openai).update!(owner: user)
      stub_request(:post, 'https://api.openai.com/v1/embeddings')
        .to_return(status: 500, body: 'boom')

      post connection_check_embedders_url, params: {
        embedder: { connection_id: connections(:openai).id, model: 'm' },
      }

      assert_response :bad_gateway
      assert_match(/500/, response.parsed_body['error'])
    end

    test 'checks an embedder on a connection with the connection\'s URL and key' do
      connections(:voyage).update!(owner: user)
      stub = stub_request(:post, 'https://api.voyageai.com/v1/embeddings')
        .with(headers: { 'Authorization' => 'Bearer pa-test-voyage' })
        .to_return(status: 200, headers: { 'Content-Type' => 'application/json' },
                   body: { data: [ { index: 0, embedding: Array.new(1024) { |i| i / 1024.0 } } ] }.to_json)

      post connection_check_embedders_url, params: {
        embedder: { connection_id: connections(:voyage).id, model: 'voyage-3.5', truncation: 'none' },
      }

      assert_response :success
      assert_requested stub
      assert_equal 1024, response.parsed_body['dimensions']
    end

    test 'will not check with a connection the user cannot use' do
      post connection_check_embedders_url, params: {
        embedder: { connection_id: connections(:private_ollama).id, model: 'm', truncation: 'none' },
      }

      assert_response :unprocessable_content
      assert_match(/isn't one you can use/, response.parsed_body['error'])
    end
  end
end
