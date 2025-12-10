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
end
