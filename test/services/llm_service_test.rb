# frozen_string_literal: true

require 'test_helper'
require 'webmock/minitest'

class LlmServiceTest < ActiveSupport::TestCase
  let(:judge) { users(:judge_judy) }
  let(:service) { LlmService.new '1234asdf5678', {} }
  let(:query_doc_pair) { query_doc_pairs(:starwars_qdp1) }

  # for these tests, we run the query to OpenAI for real first, and then record the request and the response
  # and use that in the webmock.rb file.
  # Use WebMock.allow_net_connect! and WebMock.disable_net_connect! to
  # control being able to make HTTP connections out.
  # You may need to tweak the WebMock proxy to not kick in if you want to
  # run real tests, otherwise it still captures everything.
  # This has been VERY futzy to get a test that captures the real server interaction and the webmock version.

  USER_PROMPT_IMAGE_URL = 'https://example.com/image.png'

  USER_PROMPT_TEXT = <<~TEXT
    Query: Farm animals

    doc3:
      title: This document has nothing to do with farm animals
      abstract: We will talk about everything except for farm animals.
  TEXT

  USER_PROMPT_COMPOSED = [
    { type: 'text', text: USER_PROMPT_TEXT },
    { type: 'image_url', image_url: { url: USER_PROMPT_IMAGE_URL } }
  ].freeze

  describe 'Hacking with Scott' do
    test 'can we make it run' do
      user_prompt = USER_PROMPT_COMPOSED
      system_prompt = AiJudgesController::DEFAULT_SYSTEM_PROMPT
      result = service.get_llm_response(user_prompt, system_prompt)
      puts result

      assert_kind_of Numeric, result[:judgment]
      assert_not_nil result[:explanation]
    end

    test 'making a user prompt with text and image content' do
      user_prompt = service.make_user_prompt query_doc_pair

      assert_equal user_prompt[0][:type], 'text'
      assert_includes user_prompt[0][:text], query_doc_pair.query_text

      assert_equal user_prompt[1][:type], 'image_url'
      assert_equal user_prompt[1][:image_url][:url], USER_PROMPT_IMAGE_URL
    end

    test 'creating a judgement' do
      judgement = Judgement.new(query_doc_pair: query_doc_pair, user: judge)
      service.perform_judgement judgement

      assert_instance_of Float, judgement.rating
      assert_not_nil judgement.explanation
    end
  end

  describe 'error conditions' do
    test 'using a bad API key' do
      service = LlmService.new 'BAD_OPENAI_KEY'
      user_prompt = USER_PROMPT_COMPOSED
      system_prompt = AiJudgesController::DEFAULT_SYSTEM_PROMPT

      error = assert_raises(RuntimeError) do
        service.get_llm_response(user_prompt, system_prompt)
      end
      assert_equal 'LLM API Error: 401 - Unauthorized', error.message
    end

    test 'handle and back off a 429 error' do
      # Test that we retry on 429 errors up to the max retry limit
      service = LlmService.new 'OPENAI_429_ERROR'
      user_prompt = USER_PROMPT_COMPOSED
      system_prompt = AiJudgesController::DEFAULT_SYSTEM_PROMPT

      error = assert_raises(RuntimeError) do
        service.get_llm_response(user_prompt, system_prompt)
      end
      # After 3 retries, we should get this error message
      assert_equal 'Rate limit exceeded after 3 retries', error.message
    end
  end

  describe 'using ollama' do
    test 'we can override settings and use Qwen' do
      skip 'Skipping this test as we do not know if we are running Ollama locally'
      WebMock.allow_net_connect!
      opts = {
        llm_service_url: 'http://ollama:11434',
        llm_model:       'qwen2.5:0.5b',
        llm_timeout:     90,
      }
      service = LlmService.new 'ollama', opts

      user_prompt = USER_PROMPT_COMPOSED
      system_prompt = AiJudgesController::DEFAULT_SYSTEM_PROMPT
      result = service.get_llm_response(user_prompt, system_prompt)
      puts result
      WebMock.disable_net_connect!
    end
  end

  # Streaming tests
  describe 'streaming functionality' do
    setup do
      @api_key = 'test-api-key'
      @service = LlmService.new(@api_key, {})
      @message = 'Help me understand search relevance'
    end

    test 'streams response chunks from OpenAI API' do
      # Mock the streaming response
      response_chunks = [
        "data: {\"choices\":[{\"delta\":{\"content\":\"Hello! \"}}]}\n\n",
        "data: {\"choices\":[{\"delta\":{\"content\":\"I can help \"}}]}\n\n",
        "data: {\"choices\":[{\"delta\":{\"content\":\"with that.\"}}]}\n\n",
        "data: [DONE]\n\n"
      ]

      stub_request(:post, 'https://api.openai.com/v1/chat/completions')
        .with(
          body:    hash_including({
            'stream'   => true,
            'messages' => [
              hash_including('role' => 'system'),
              hash_including('role' => 'user', 'content' => @message)
            ],
          }),
          headers: {
            'Authorization' => "Bearer #{@api_key}",
            'Content-Type'  => 'application/json',
          }
        )
        .to_return(
          status:  200,
          body:    response_chunks.join,
          headers: { 'Content-Type' => 'text/event-stream' }
        )

      collected_chunks = []
      @service.stream_chat_response(@message) do |chunk|
        collected_chunks << chunk
      end

      assert_equal [ 'Hello! ', 'I can help ', 'with that.' ], collected_chunks
    end

    test 'handles [DONE] signal correctly' do
      response_chunks = [
        "data: {\"choices\":[{\"delta\":{\"content\":\"Test\"}}]}\n\n",
        "data: [DONE]\n\n"
      ]

      stub_request(:post, 'https://api.openai.com/v1/chat/completions')
        .to_return(
          status:  200,
          body:    response_chunks.join,
          headers: { 'Content-Type' => 'text/event-stream' }
        )

      collected_chunks = []
      @service.stream_chat_response(@message) do |chunk|
        collected_chunks << chunk
      end

      assert_equal [ 'Test' ], collected_chunks
    end

    test 'handles empty lines in SSE stream' do
      response_chunks = [
        "data: {\"choices\":[{\"delta\":{\"content\":\"Line 1\"}}]}\n\n",
        "\n\n", # Empty lines
        "data: {\"choices\":[{\"delta\":{\"content\":\"Line 2\"}}]}\n\n",
        "data: [DONE]\n\n"
      ]

      stub_request(:post, 'https://api.openai.com/v1/chat/completions')
        .to_return(
          status:  200,
          body:    response_chunks.join,
          headers: { 'Content-Type' => 'text/event-stream' }
        )

      collected_chunks = []
      @service.stream_chat_response(@message) do |chunk|
        collected_chunks << chunk
      end

      assert_equal [ 'Line 1', 'Line 2' ], collected_chunks
    end

    test 'handles JSON parse errors gracefully' do
      response_chunks = [
        "data: {\"choices\":[{\"delta\":{\"content\":\"Valid\"}}]}\n\n",
        "data: {invalid json}\n\n", # Invalid JSON
        "data: {\"choices\":[{\"delta\":{\"content\":\"After error\"}}]}\n\n",
        "data: [DONE]\n\n"
      ]

      stub_request(:post, 'https://api.openai.com/v1/chat/completions')
        .to_return(
          status:  200,
          body:    response_chunks.join,
          headers: { 'Content-Type' => 'text/event-stream' }
        )

      collected_chunks = []
      @service.stream_chat_response(@message) do |chunk|
        collected_chunks << chunk
      end

      # Should continue processing after JSON error
      assert_equal [ 'Valid', 'After error' ], collected_chunks
    end

    test 'handles HTTP errors' do
      stub_request(:post, 'https://api.openai.com/v1/chat/completions')
        .to_return(status: 429, body: 'Rate limit exceeded')

      collected_chunks = []
      @service.stream_chat_response(@message) do |chunk|
        collected_chunks << chunk
      end

      assert_equal 1, collected_chunks.size
      assert_match(/encountered an error/, collected_chunks.first)
    end

    test 'handles read timeout' do
      stub_request(:post, 'https://api.openai.com/v1/chat/completions')
        .to_timeout

      collected_chunks = []
      @service.stream_chat_response(@message) do |chunk|
        collected_chunks << chunk
      end

      assert_equal 1, collected_chunks.size
      assert_match(/trouble connecting|encountered an error/, collected_chunks.first)
    end

    test 'falls back to non-streaming for non-OpenAI services' do
      # Create service with non-OpenAI URL
      service = LlmService.new(@api_key, { llm_service_url: 'http://localhost:11434' })

      # Mock the fallback response
      stub_request(:post, 'http://localhost:11434/v1/chat/completions')
        .with(
          body: hash_including({
            'messages' => [
              hash_including('role' => 'system'),
              hash_including('role' => 'user', 'content' => @message)
            ],
          })
        )
        .to_return(
          status: 200,
          body:   {
            'choices' => [
              { 'message' => { 'content' => 'Non-streaming response' } }
            ],
          }.to_json
        )

      collected_chunks = []
      service.stream_chat_response(@message) do |chunk|
        collected_chunks << chunk
      end

      assert_equal [ 'Non-streaming response' ], collected_chunks
    end

    test 'includes system prompt for Quepid context' do
      stub_request(:post, 'https://api.openai.com/v1/chat/completions')
        .with do |request|
          body = JSON.parse(request.body)
          messages = body['messages']

          messages.is_a?(Array) &&
            2 == messages.size &&
            'system' == messages[0]['role'] &&
            messages[0]['content'] =~ /helpful assistant for Quepid/ &&
            'user' == messages[1]['role'] &&
            messages[1]['content'] == @message
        end
        .to_return(
          status: 200,
          body:   "data: {\"choices\":[{\"delta\":{\"content\":\"OK\"}}]}\n\ndata: [DONE]\n\n"
        )

      # rubocop:disable Lint/EmptyBlock
      @service.stream_chat_response(@message) { |chunk| }
      # rubocop:enable Lint/EmptyBlock

      assert_requested :post, 'https://api.openai.com/v1/chat/completions'
    end

    test 'respects temperature and max_tokens settings' do
      stub_request(:post, 'https://api.openai.com/v1/chat/completions')
        .with(
          body: hash_including({
            'temperature' => 0.7,
            'max_tokens'  => 1000,
          })
        )
        .to_return(
          status: 200,
          body:   "data: {\"choices\":[{\"delta\":{\"content\":\"OK\"}}]}\n\ndata: [DONE]\n\n"
        )

      # rubocop:disable Lint/EmptyBlock
      @service.stream_chat_response(@message) { |chunk| }
      # rubocop:enable Lint/EmptyBlock

      assert_requested :post, 'https://api.openai.com/v1/chat/completions'
    end

    test 'handles chunks with missing content gracefully' do
      response_chunks = [
        "data: {\"choices\":[{\"delta\":{}}]}\n\n", # No content field
        "data: {\"choices\":[{\"delta\":{\"content\":\"Valid\"}}]}\n\n",
        "data: {\"choices\":[{}]}\n\n", # No delta field
        "data: [DONE]\n\n"
      ]

      stub_request(:post, 'https://api.openai.com/v1/chat/completions')
        .to_return(
          status:  200,
          body:    response_chunks.join,
          headers: { 'Content-Type' => 'text/event-stream' }
        )

      collected_chunks = []
      @service.stream_chat_response(@message) do |chunk|
        collected_chunks << chunk
      end

      # Should only get the valid chunk
      assert_equal [ 'Valid' ], collected_chunks
    end

    test 'get_chat_response returns non-streaming response' do
      stub_request(:post, 'https://api.openai.com/v1/chat/completions')
        .with(
          body: hash_including({
            'messages' => [
              hash_including('role' => 'system'),
              hash_including('role' => 'user', 'content' => @message)
            ],
          })
        )
        .to_return(
          status: 200,
          body:   {
            'choices' => [
              { 'message' => { 'content' => 'This is a chat response' } }
            ],
          }.to_json
        )

      response = @service.get_chat_response(@message)
      assert_equal 'This is a chat response', response
    end
  end

  describe 'URL construction' do
    [
      {
        name:         'builds correct URL for services with subpaths like Gemini',
        base_url:     'https://generativelanguage.googleapis.com/v1beta/openai',
        expected_url: 'https://generativelanguage.googleapis.com/v1beta/openai/v1/chat/completions',
      },
      {
        name:         'builds correct URL for services with no subpath and no trailing slash',
        base_url:     'https://api.openai.com',
        expected_url: 'https://api.openai.com/v1/chat/completions',
      },
      {
        name:         'builds correct URL for services with no subpath and with trailing slash',
        base_url:     'https://api.openai.com/',
        expected_url: 'https://api.openai.com//v1/chat/completions',
      }
    ].each do |test_case|
      test test_case[:name] do
        stub_request(:post, test_case[:expected_url])
          .to_return(status: 200, body: { choices: [ { message: { content: '{"judgment": 1, "explanation": "Good"}' } } ] }.to_json, headers: { 'Content-Type' => 'application/json' })

        opts = {
          llm_service_url: test_case[:base_url],
        }
        service = LlmService.new 'api-key', opts

        user_prompt = USER_PROMPT_COMPOSED
        system_prompt = AiJudgesController::DEFAULT_SYSTEM_PROMPT

        service.get_llm_response(user_prompt, system_prompt)

        assert_requested(:post, test_case[:expected_url])
      end
    end
  end
end
