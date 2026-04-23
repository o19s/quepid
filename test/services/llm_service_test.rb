# frozen_string_literal: true

require 'test_helper'

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

      assert_equal 'text', user_prompt[0][:type]
      assert_includes user_prompt[0][:text], query_doc_pair.query_text

      assert_equal 'image_url', user_prompt[1][:type]
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
      # the Faraday Retry may mean we don't need this
      service = LlmService.new 'OPENAI_429_ERROR'
      user_prompt = USER_PROMPT_COMPOSED
      system_prompt = AiJudgesController::DEFAULT_SYSTEM_PROMPT

      error = assert_raises(RuntimeError) do
        service.get_llm_response(user_prompt, system_prompt)
      end
      assert_equal 'LLM API Error: 429 - Too Many Requests', error.message
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
        expected_url: 'https://api.openai.com/v1/chat/completions',
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

  describe 'Azure provider support' do
    test 'Azure OpenAI with api-version uses deployment path' do
      azure_url = 'https://myresource.openai.azure.com/openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-10-21'
      stub_request(:post, azure_url)
        .with(headers: { 'api-key' => 'my-azure-key' })
        .to_return(
          status:  200,
          body:    { choices: [ { message: { content: '{"judgment": 2, "explanation": "Good"}' } } ] }.to_json,
          headers: { 'Content-Type' => 'application/json' }
        )

      opts = {
        llm_provider:    'azure_openai',
        llm_service_url: 'https://myresource.openai.azure.com',
        llm_model:       'gpt-4o-mini',
        llm_api_version: '2024-10-21',
      }
      service = LlmService.new 'my-azure-key', opts
      result = service.get_llm_response(USER_PROMPT_COMPOSED, AiJudgesController::DEFAULT_SYSTEM_PROMPT)

      assert_equal 2, result[:judgment]
      assert_requested(:post, azure_url)
    end

    test 'Azure AI Foundry uses api-key header and correct path' do
      foundry_url = 'https://myresource.services.ai.azure.com/models/chat/completions?api-version=2025-01-01-preview'
      stub_request(:post, foundry_url)
        .with(headers: { 'api-key' => 'my-foundry-key' })
        .to_return(
          status:  200,
          body:    { choices: [ { message: { content: '{"judgment": 1, "explanation": "OK"}' } } ] }.to_json,
          headers: { 'Content-Type' => 'application/json' }
        )

      opts = {
        llm_provider:    'azure_ai_foundry',
        llm_service_url: 'https://myresource.services.ai.azure.com',
        llm_api_version: '2025-01-01-preview',
      }
      service = LlmService.new 'my-foundry-key', opts
      result = service.get_llm_response(USER_PROMPT_COMPOSED, AiJudgesController::DEFAULT_SYSTEM_PROMPT)

      assert_equal 1, result[:judgment]
      assert_requested(:post, foundry_url)
    end

    test 'Azure AI Foundry Serverless uses api-key header and v1 path' do
      serverless_url = 'https://haiku-35.eastus.models.ai.azure.com/v1/chat/completions'
      stub_request(:post, serverless_url)
        .with(headers: { 'api-key' => 'my-serverless-key' })
        .to_return(
          status:  200,
          body:    { choices: [ { message: { content: '{"judgment": 2, "explanation": "Decent"}' } } ] }.to_json,
          headers: { 'Content-Type' => 'application/json' }
        )

      opts = {
        llm_provider:    'azure_ai_foundry_serverless',
        llm_service_url: 'https://haiku-35.eastus.models.ai.azure.com',
      }
      service = LlmService.new 'my-serverless-key', opts
      result = service.get_llm_response(USER_PROMPT_COMPOSED, AiJudgesController::DEFAULT_SYSTEM_PROMPT)

      assert_equal 2, result[:judgment]
      assert_requested(:post, serverless_url,
                       headers: { 'api-key' => 'my-serverless-key' })
    end

    test 'Azure OpenAI without api-version uses v1 path' do
      azure_url = 'https://myresource.openai.azure.com/openai/v1/chat/completions'
      stub_request(:post, azure_url)
        .to_return(
          status:  200,
          body:    { choices: [ { message: { content: '{"judgment": 3, "explanation": "Great"}' } } ] }.to_json,
          headers: { 'Content-Type' => 'application/json' }
        )

      opts = {
        llm_provider:    'azure_openai',
        llm_service_url: 'https://myresource.openai.azure.com',
      }
      service = LlmService.new 'my-azure-key', opts
      service.get_llm_response(USER_PROMPT_COMPOSED, AiJudgesController::DEFAULT_SYSTEM_PROMPT)

      assert_requested(:post, azure_url,
                       headers: { 'api-key' => 'my-azure-key' })
    end

    test 'Azure AI Foundry Anthropic uses x-api-key header, anthropic-version, and Messages API' do
      anthropic_url = 'https://myresource.services.ai.azure.com/anthropic/v1/messages'
      # Anthropic Messages API response format
      anthropic_response = {
        content: [ { type: 'text', text: '{"judgment": 2, "explanation": "Relevant result"}' } ],
        model:   'claude-haiku-4-5',
        role:    'assistant',
      }
      stub_request(:post, anthropic_url)
        .with(
          headers: {
            'x-api-key'         => 'my-anthropic-azure-key',
            'anthropic-version' => '2023-06-01',
          }
        )
        .to_return(
          status:  200,
          body:    anthropic_response.to_json,
          headers: { 'Content-Type' => 'application/json' }
        )

      opts = {
        llm_provider:    'azure_ai_foundry_anthropic',
        llm_service_url: 'https://myresource.services.ai.azure.com/anthropic',
        llm_model:       'claude-haiku-4-5',
      }
      service = LlmService.new 'my-anthropic-azure-key', opts
      result = service.get_llm_response(USER_PROMPT_COMPOSED, AiJudgesController::DEFAULT_SYSTEM_PROMPT)

      assert_equal 2, result[:judgment]
      assert_equal 'Relevant result', result[:explanation]
      assert_requested(:post, anthropic_url,
                       headers: { 'x-api-key' => 'my-anthropic-azure-key', 'anthropic-version' => '2023-06-01' })
    end

    test 'Anthropic provider uses x-api-key header and Messages API' do
      anthropic_url = 'https://api.anthropic.com/v1/messages'
      anthropic_response = {
        content: [ { type: 'text', text: '{"judgment": 3, "explanation": "Highly relevant"}' } ],
        model:   'claude-sonnet-4-20250514',
        role:    'assistant',
      }
      stub_request(:post, anthropic_url)
        .with(
          headers: {
            'x-api-key'         => 'my-anthropic-key',
            'anthropic-version' => '2023-06-01',
          }
        )
        .to_return(
          status:  200,
          body:    anthropic_response.to_json,
          headers: { 'Content-Type' => 'application/json' }
        )

      opts = {
        llm_provider:    'anthropic',
        llm_service_url: 'https://api.anthropic.com',
        llm_model:       'claude-sonnet-4-20250514',
      }
      service = LlmService.new 'my-anthropic-key', opts
      result = service.get_llm_response(USER_PROMPT_COMPOSED, AiJudgesController::DEFAULT_SYSTEM_PROMPT)

      assert_equal 3, result[:judgment]
      assert_equal 'Highly relevant', result[:explanation]
      assert_requested(:post, anthropic_url,
                       headers: { 'x-api-key' => 'my-anthropic-key', 'anthropic-version' => '2023-06-01' })
    end

    test 'existing judges with no llm_provider use Bearer auth and v1 path' do
      # Uses the existing webmock stub for https://api.openai.com/v1/chat/completions
      # with Authorization: Bearer 1234asdf5678
      service = LlmService.new '1234asdf5678', { llm_service_url: 'https://api.openai.com' }
      result = service.get_llm_response(USER_PROMPT_COMPOSED, AiJudgesController::DEFAULT_SYSTEM_PROMPT)

      assert_kind_of Numeric, result[:judgment]
      assert_requested(:post, 'https://api.openai.com/v1/chat/completions',
                       headers: { 'Authorization' => 'Bearer 1234asdf5678' })
    end
  end
end
