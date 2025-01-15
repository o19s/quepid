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

  DEFAULT_USER_PROMPT = <<~TEXT
    Query: Farm animals

    doc3:
      title: This document has nothing to do with farm animals
      abstract: We will talk about everything except for farm animals.
  TEXT

  describe 'Hacking with Scott' do
    test 'can we make it run' do
      # WebMock.allow_net_connect!
      user_prompt = DEFAULT_USER_PROMPT
      system_prompt = AiJudgesController::DEFAULT_SYSTEM_PROMPT
      result = service.get_llm_response(user_prompt, system_prompt)
      puts result

      assert_kind_of Numeric, result[:judgment]
      assert_not_nil result[:explanation]

      # WebMock.disable_net_connect!
    end

    test 'making a user prompt' do
      user_prompt = service.make_user_prompt query_doc_pair
      assert_includes user_prompt, query_doc_pair.query_text
    end

    test 'creating a judgement' do
      judgement = service.make_judgement judge, query_doc_pair

      assert_instance_of Float, judgement.rating
      assert_not_nil judgement.explanation
    end
  end

  describe 'error conditions' do
    test 'using a bad API key' do
      # WebMock.disable!
      service = LlmService.new 'BAD_OPENAI_KEY'
      user_prompt = DEFAULT_USER_PROMPT
      system_prompt = AiJudgesController::DEFAULT_SYSTEM_PROMPT

      assert_raises(RuntimeError, '401 - Unauthorized') do
        service.get_llm_response(user_prompt, system_prompt)
      end

      # WebMock.enable!
    end

    test 'it all blows up' do
      assert true
    end
  end
end
