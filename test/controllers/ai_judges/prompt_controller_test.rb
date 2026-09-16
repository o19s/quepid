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

      test 'without a book, falls back to a book the current user can access when the judge has an owner' do
        owned_judge = AiJudge.create!(name: 'Owned Judge', llm_key: '1234', owner: user)

        get edit_ai_judge_prompt_url(ai_judge_id: owned_judge.id)
        assert_response :success

        query_doc_pair = assigns(:query_doc_pair)
        assert_predicate query_doc_pair, :persisted?
        assert_includes(Book.for_user(user).flat_map(&:query_doc_pairs), query_doc_pair)
      end

      test 'without a book, falls back to a book the requesting teammate can access, not a book private to the judge owner' do
        owner = users(:case_finder_user)
        shared_team = teams(:case_finder_owned_team) # random and case_finder_user are both members

        private_book = Book.create!(name: 'owner-private book', owner: owner)
        private_qdp = private_book.query_doc_pairs.create!(query_text: 'q', doc_id: 'd', position: 1)

        shared_judge = AiJudge.create!(name: 'Shared Judge', llm_key: '1234', owner: owner, teams: [ shared_team ])

        get edit_ai_judge_prompt_url(ai_judge_id: shared_judge.id)
        assert_response :success

        assert_not_equal private_qdp, assigns(:query_doc_pair)
      end

      test 'is not found when the ai judge is not owned by or shared with the current user' do
        login_user_for_integration_test users(:case_finder_user)

        get edit_ai_judge_prompt_url(ai_judge_id: ai_judge.id)

        assert_response :not_found
      end
    end

    describe 'patch update' do
      test 'is not found when the ai judge is not owned by or shared with the current user' do
        login_user_for_integration_test users(:case_finder_user)

        patch ai_judge_prompt_url(ai_judge_id: ai_judge.id), params: { user: { system_prompt: 'hijacked' } }

        assert_response :not_found
        assert_equal 'You are a grocery store shopper.  You like cheese.  Is this a cheese?', ai_judge.reload.system_prompt
      end
    end

    # test 'should get update' do
    #   patch ai_judge_prompt_url
    #   assert_response :success
    # end
  end
end
