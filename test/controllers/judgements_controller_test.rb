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
  end
  describe 'index filtering' do
    let(:jbm_book) { books(:james_bond_movies) }

    def listed_ids
      assigns(:judgements).map(&:id)
    end

    test 'filters by user_id' do
      get book_judgements_url(jbm_book), params: { user_id: users(:doug).id }

      assert_response :success
      assert_includes listed_ids, judgements(:high_judgement).id
      assert_not_includes listed_ids, judgements(:low_judgement).id
      assert(assigns(:judgements).all? { |j| j.user_id == users(:doug).id })
    end

    test 'filters to unrateable judgements' do
      unrateable = Judgement.create!(query_doc_pair: query_doc_pairs(:jbm_qdp3), user: user, unrateable: true)

      get book_judgements_url(jbm_book), params: { unrateable: '1' }

      assert_response :success
      assert_equal [ unrateable.id ], listed_ids
    end

    test 'filters to judge later judgements' do
      later = Judgement.create!(query_doc_pair: query_doc_pairs(:jbm_qdp4), user: user, judge_later: true)

      get book_judgements_url(jbm_book), params: { judge_later: '1' }

      assert_response :success
      assert_equal [ later.id ], listed_ids
    end

    test 'filters by query_doc_pair_id field search' do
      qdp = query_doc_pairs(:jbm_qdp2)

      get book_judgements_url(jbm_book), params: { q: "query_doc_pair_id:#{qdp.id}" }

      assert_response :success
      assert_equal [ judgements(:low_judgement).id ], listed_ids
    end

    test 'filters by generic text search' do
      qdp = query_doc_pairs(:jbm_qdp1)

      get book_judgements_url(jbm_book), params: { q: qdp.doc_id.downcase }

      assert_response :success
      assert_includes listed_ids, judgements(:high_judgement).id
    end

    test 'defaults compact on and respects the checkbox once filtered' do
      get book_judgements_url(jbm_book)
      assert assigns(:compact)

      get book_judgements_url(jbm_book), params: { filtered: '1' }
      assert_not assigns(:compact)

      get book_judgements_url(jbm_book), params: { filtered: '1', compact: '1' }
      assert assigns(:compact)
    end
  end

  describe 'failed and special writes' do
    let(:jbm_book) { books(:james_bond_movies) }

    test 'create without a rating re-renders new and does not save' do
      qdp = query_doc_pairs(:jbm_qdp3)

      assert_no_difference('Judgement.count') do
        post book_judgements_url(jbm_book), params: { judgement: { query_doc_pair_id: qdp.id, rating: '' } }
      end

      assert_response :unprocessable_content
      assert_equal qdp, assigns(:query_doc_pair)
    end

    test 'create for a pair the user already judged updates instead of duplicating' do
      existing = judgements(:low_judgement)

      assert_no_difference('Judgement.count') do
        post book_judgements_url(jbm_book),
             params: { judgement: { query_doc_pair_id: existing.query_doc_pair_id, rating: 3 } }
      end

      assert_redirected_to book_judge_path(jbm_book)
      assert_equal 3, existing.reload.rating
    end

    test 'update with a blank rating re-renders edit and keeps the old rating' do
      existing = judgements(:low_judgement)

      patch book_judgement_url(jbm_book, existing), params: { judgement: { rating: '' } }

      assert_response :unprocessable_content
      assert_equal 0, existing.reload.rating
    end

    test 'unrateable marks the judgement and clears the rating' do
      qdp = query_doc_pairs(:jbm_qdp3)

      assert_difference('Judgement.count') do
        post book_query_doc_pair_unrateable_url(jbm_book, qdp), params: { judgement: { explanation: 'garbled' } }
      end

      assert_redirected_to book_judge_path(jbm_book)
      judgement = Judgement.find_by(query_doc_pair: qdp, user: user)
      assert judgement.unrateable
      assert_nil judgement.rating
    end

    test 'judge_later marks the judgement' do
      qdp = query_doc_pairs(:jbm_qdp4)

      get book_query_doc_pair_judge_later_url(jbm_book, qdp)

      assert_redirected_to book_judge_path(jbm_book)
      assert Judgement.find_by(query_doc_pair: qdp, user: user).judge_later
    end

    test 'skip_judging redirects to judge' do
      get book_skip_judging_url(jbm_book)

      assert_redirected_to book_judge_path(jbm_book)
    end

    test 'judge redirects to the book once everything is judged' do
      empty_book = Book.create!(name: 'Nothing To Judge', owner: user, scale: '0,1')

      get book_judge_url(empty_book)

      assert_redirected_to book_path(empty_book)
      assert_equal 'You have judged all the documents you can!', flash[:notice]
    end

    test 'the 50th judge request in a session shows the leaderboard' do
      49.times do
        get book_judge_url(jbm_book)
        assert_not assigns(:party_time)
      end

      get book_judge_url(jbm_book)

      assert assigns(:party_time)
      assert_predicate assigns(:leaderboard_data), :present?
      assert(assigns(:leaderboard_data).all? { |row| row.key?(:judge) && row.key?(:judgements) })
    end

    test 'the judge counter restarts when switching books' do
      49.times { get book_judge_url(jbm_book) }

      get book_judge_url(book)

      assert_not assigns(:party_time)
    end
  end
end
