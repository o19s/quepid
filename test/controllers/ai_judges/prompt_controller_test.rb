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

    # test 'should get update' do
    #   patch ai_judge_prompt_url
    #   assert_response :success
    # end
  end
end
