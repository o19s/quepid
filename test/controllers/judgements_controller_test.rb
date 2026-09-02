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
end
