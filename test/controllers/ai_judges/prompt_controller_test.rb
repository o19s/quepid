# frozen_string_literal: true

require 'test_helper'

module AiJudges
  class PromptControllerTest < ActionDispatch::IntegrationTest
    let(:user) { users(:random) }
    let(:ai_judge) { users(:judge_judy) }
    let(:team) { teams(:shared) }
    let(:book) { books(:james_bond_movies) }

    setup do
      login_user_for_integration_test user
    end

    describe 'get edit' do
      test 'should randomly pick qyer_doc_pair' do
        get edit_ai_judge_prompt_url(ai_judge_id: ai_judge.id)
        assert_response :success

        assert assigns(:query_doc_pair)
      end

      test 'should get query_doc_pair from book if provided' do
        get edit_ai_judge_prompt_url(ai_judge_id: ai_judge.id), params: { book_id: book.id }
        assert_response :success

        assert assigns(:query_doc_pair)
        assert_includes(book.query_doc_pairs, assigns(:query_doc_pair))
      end
    end

    describe 'patch update' do
      setup { register_default_openai_stubs }

      test 'threads book context into the LLM call, so the system prompt reflects the book scale' do
        captured_system_prompt = nil
        stub_request(:post, 'https://api.openai.com/v1/chat/completions')
          .with(headers: { 'Authorization' => "Bearer #{OPENAI_VALID_KEY}" }) do |req|
            captured_system_prompt = JSON.parse(req.body)['messages'].find { |m| 'system' == m['role'] }['content']
            true
          end
          .to_return(status: 200, body: { choices: [ { message: { content: '{"judgment": 0, "explanation": "ok"}' } } ] }.to_json, headers: {})

        patch ai_judge_prompt_url(ai_judge_id: ai_judge.id),
              params: {
                book_id:        book.id,
                user:           { system_prompt: ai_judge.system_prompt },
                query_doc_pair: { query_text: 'what year was this released?', doc_id: 'goldeneye', document_fields: '{}' },
              }

        assert_response :success
        assert_includes captured_system_prompt, "This book's rating scale is:"
      end
    end
  end
end
