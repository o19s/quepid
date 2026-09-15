# frozen_string_literal: true

require 'test_helper'

class JudgementsControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:random) }
  let(:book) { books(:book_of_comedy_films) }

  setup do
    @judgement = judgements(:one)
    get '/books'
    assert_equal 302, status
    follow_redirect!

    login_user_for_integration_test user
  end

  test 'should get index' do
    get book_judgements_url book
    assert_response :success
  end

  test 'returns not found when the book is missing or not accessible' do
    get book_judgements_url(book_id: 999_999)
    assert_response :not_found
  end

  #   test 'should get new' do
  #     get new_judgement_url
  #     assert_response :success
  #   end

  #   test 'should create judgement' do
  #     assert_difference('Judgement.count') do
  #       post judgements_url,
  #            params: { judgement: { query_doc_pair_id: @judgement.query_doc_pair_id, rating: @judgement.rating,
  # user_id: @judgement.user_id } }
  #     end

  #     assert_redirected_to judgement_url(Judgement.last)
  #   end

  #   test 'should show judgement' do
  #     get judgement_url(@judgement)
  #     assert_response :success
  #   end

  #   test 'should get edit' do
  #     get edit_judgement_url(@judgement)
  #     assert_response :success
  #   end

  #   test 'should update judgement' do
  #     patch judgement_url(@judgement),
  #           params: { judgement: { query_doc_pair_id: @judgement.query_doc_pair_id, rating: @judgement.rating,
  # user_id: @judgement.user_id } }
  #     assert_redirected_to judgement_url(@judgement)
  #   end

  #   test 'should destroy judgement' do
  #     assert_difference('Judgement.count', -1) do
  #       delete judgement_url(@judgement)
  #     end

  #     assert_redirected_to judgements_url
  #   end

  describe 'broadcasting judge activity' do
    let(:query_doc_pair) { query_doc_pairs(:book_of_comedy_qdp1) }

    test 'create broadcasts judge activity' do
      assert_enqueued_with(job: BroadcastJudgeActivityJob) do
        post book_judgements_url(book), params: { judgement: { query_doc_pair_id: query_doc_pair.id, rating: 1 } }
      end
    end

    test 'unrateable broadcasts judge activity' do
      assert_enqueued_with(job: BroadcastJudgeActivityJob) do
        patch book_query_doc_pair_unrateable_path(book, query_doc_pair),
              params: { judgement: { explanation: 'not rateable' } }
      end
    end

    test 'judge_later broadcasts judge activity' do
      assert_enqueued_with(job: BroadcastJudgeActivityJob) do
        get book_query_doc_pair_judge_later_path(book, query_doc_pair)
      end
    end

    test 'update broadcasts judge activity' do
      judgement = judgements(:comedy_qdp1_judgement)

      assert_enqueued_with(job: BroadcastJudgeActivityJob) do
        patch book_judgement_url(book, judgement), params: { judgement: { rating: 2 } }
      end
    end

    test 'destroy broadcasts judge activity' do
      judgement = judgements(:comedy_qdp1_judgement)

      assert_enqueued_with(job: BroadcastJudgeActivityJob) do
        delete book_judgement_url(book, judgement)
      end
    end
  end
end
