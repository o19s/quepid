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

  DEFAULT_USER_PROMPT = <<~TEXT
    Query: Farm animals

    doc3:
      title: This document has nothing to do with farm animals
      abstract: We will talk about everything except for farm animals.
  TEXT

  describe 'Hacking with Scott' do
    test 'can we make it run' do
      user_prompt = DEFAULT_USER_PROMPT
      system_prompt = AiJudgesController::DEFAULT_SYSTEM_PROMPT
      result = service.get_llm_response(user_prompt, system_prompt)
      puts result

      assert_kind_of Numeric, result[:judgment]
      assert_not_nil result[:explanation]
    end
    test 'making a user prompt' do
      user_prompt = service.make_user_prompt query_doc_pair
      assert_includes user_prompt, query_doc_pair.query_text
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
      user_prompt = DEFAULT_USER_PROMPT
      system_prompt = AiJudgesController::DEFAULT_SYSTEM_PROMPT

      error = assert_raises(RuntimeError) do
        service.get_llm_response(user_prompt, system_prompt)
      end
      assert_equal 'LLM API Error: 401 - Unauthorized', error.message
    end

    test 'handle and back off a 429 error' do
      # the Faraday Retry may mean we don't need this
      service = LlmService.new 'OPENAI_429_ERROR'
      user_prompt = DEFAULT_USER_PROMPT
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

      user_prompt = DEFAULT_USER_PROMPT
      system_prompt = AiJudgesController::DEFAULT_SYSTEM_PROMPT
      result = service.get_llm_response(user_prompt, system_prompt)
      puts result
      WebMock.disable_net_connect!
    end
  end
end
