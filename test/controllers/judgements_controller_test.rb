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

  describe 'judgement CRUD, nested under a book the user has access to' do
    let(:jbm_book) { books(:james_bond_movies) }
    let(:existing_judgement) { judgements(:low_judgement) }

    test 'should get new' do
      get new_book_judgement_url(jbm_book)
      assert_response :success
    end

    test 'should create judgement' do
      query_doc_pair = query_doc_pairs(:jbm_qdp1)

      assert_difference('Judgement.count') do
        post book_judgements_url(jbm_book), params: { judgement: { query_doc_pair_id: query_doc_pair.id, rating: 2 } }
      end

      assert_redirected_to book_judge_path(jbm_book)
      assert_equal user, Judgement.last.user
    end

    test 'should show judgement' do
      get book_judgement_url(jbm_book, existing_judgement)
      assert_response :success
    end

    test 'should get edit' do
      get edit_book_judgement_url(jbm_book, existing_judgement)
      assert_response :success
    end

    describe 'an escalated pair' do
      let(:pair) { query_doc_pairs(:jbm_qdp1) }
      let(:cheap) { AiJudge.create!(name: 'Cheap Judge') }
      let(:expensive) { AiJudge.create!(name: 'Expensive Judge') }
      let(:source) do
        pair.judgements.create!(user: cheap, unrateable: true,
                                explanation: "Jev rated 1. [confidence 0.64 is below this judge's minimum " \
                                             'confidence of 0.8, so it was marked unrateable]')
      end
      let(:escalated) { pair.judgements.create!(user: expensive, rating: 1, escalated_from: source) }

      before { escalated }

      test 'the unrateable judgement says it was handed on, to whom, and links there' do
        get edit_book_query_doc_pair_judgement_url(jbm_book, pair, source)

        assert_response :success
        assert_select '#escalation-notice', text: /because its confidence \(0.64\) was below its minimum confidence of 0.8/
        assert_select '#escalation-notice', text: /handed on\s+to Expensive Judge, which\s+rated it 1/
        assert_select '#escalation-notice a[href=?]', edit_book_query_doc_pair_judgement_path(jbm_book, pair, escalated)
      end

      test 'the escalated judgement says where it came from, and links back' do
        get edit_book_query_doc_pair_judgement_url(jbm_book, pair, escalated)

        assert_response :success
        assert_select '#escalated-from-notice',
                      text: /Cheap Judge's answer was unrateable: its confidence \(0.64\) was below its minimum confidence of 0.8/
        assert_select '#escalated-from-notice a[href=?]', edit_book_query_doc_pair_judgement_path(jbm_book, pair, source)
      end

      test 'a judgement nobody escalated shows no notice' do
        get edit_book_judgement_url(jbm_book, existing_judgement)

        assert_select '#escalation-notice', count: 0
        assert_select '#escalated-from-notice', count: 0
      end
    end

    test 'should update judgement' do
      patch book_judgement_url(jbm_book, existing_judgement), params: { judgement: { rating: 3 } }

      assert_redirected_to book_judge_path(jbm_book)
      assert_equal 3, existing_judgement.reload.rating
    end

    test 'should destroy judgement' do
      assert_difference('Judgement.count', -1) do
        delete book_judgement_url(jbm_book, existing_judgement)
      end

      assert_redirected_to book_judge_path(jbm_book)
    end

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
end
