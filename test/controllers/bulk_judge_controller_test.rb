# frozen_string_literal: true

require 'test_helper'

class BulkJudgeControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:random) }
  let(:book) { books(:book_of_comedy_films) }
  let(:query_doc_pair) { query_doc_pairs(:one) }

  setup do
    login_user_for_integration_test user
  end

  describe '#new' do
    test 'renders the bulk judge page successfully' do
      get book_judge_bulk_path(book)
      assert_response :success
    end

    test 'filters by query text when provided' do
      get book_judge_bulk_path(book), params: { query_text: 'funny' }
      assert_response :success
      assert_not_nil assigns(:query_text)
      assert_equal 'funny', assigns(:query_text)
    end

    test 'filters by rank depth when provided' do
      get book_judge_bulk_path(book), params: { rank_depth: 10 }
      assert_response :success
      assert_not_nil assigns(:rank_depth)
      assert_equal 10, assigns(:rank_depth)
    end

    test 'defaults to showing only unrated items' do
      get book_judge_bulk_path(book)
      assert_response :success
      assert assigns(:only_unrated)
    end

    test 'shows all items when only_unrated is false' do
      get book_judge_bulk_path(book), params: { only_unrated: false }
      assert_response :success
      assert_not assigns(:only_unrated)
    end

    test 'hides explanations by default' do
      get book_judge_bulk_path(book)
      assert_response :success
      assert_not assigns(:show_explanations)
    end

    test 'shows explanations when parameter is true' do
      get book_judge_bulk_path(book), params: { show_explanations: true }
      assert_response :success
      assert assigns(:show_explanations)
    end

    test 'paginates results' do
      get book_judge_bulk_path(book)
      assert_response :success
      assert_not_nil assigns(:pagy)
      assert_not_nil assigns(:grouped_query_doc_pairs)
    end

    test 'prepares judgements for display' do
      get book_judge_bulk_path(book)
      assert_response :success
      assert_not_nil assigns(:judgements)
      assert_instance_of Hash, assigns(:judgements)
    end
  end

  describe '#save' do
    test 'creates a new judgement with rating' do
      assert_difference 'Judgement.count' do
        post book_judge_bulk_save_path(book),
             params: { query_doc_pair_id: query_doc_pair.id, rating: 3 },
             as: :json
      end
      assert_response :success
      json_response = JSON.parse(response.body)
      assert_equal 'success', json_response['status']
      assert_not_nil json_response['judgement_id']
    end

    test 'updates an existing judgement' do
      judgement = Judgement.create!(
        query_doc_pair: query_doc_pair,
        user:           user,
        rating:         1
      )

      assert_no_difference 'Judgement.count' do
        post book_judge_bulk_save_path(book),
             params: { query_doc_pair_id: query_doc_pair.id, rating: 5 },
             as: :json
      end

      assert_response :success
      judgement.reload
      assert_equal 5, judgement.rating
    end

    test 'resets judgement when reset parameter is true' do
      judgement = Judgement.create!(
        query_doc_pair: query_doc_pair,
        user:           user,
        rating:         3,
        unrateable:     true
      )

      post book_judge_bulk_save_path(book),
           params: { query_doc_pair_id: query_doc_pair.id, reset: true },
           as: :json

      assert_response :success
      judgement.reload
      assert_nil judgement.rating
      assert_not judgement.unrateable
      assert_not judgement.judge_later
    end

    test 'updates explanation when provided' do
      post book_judge_bulk_save_path(book),
           params: {
             query_doc_pair_id: query_doc_pair.id,
             rating:            3,
             explanation:       'This is a great match'
           },
           as: :json

      assert_response :success
      judgement = Judgement.find_by(query_doc_pair: query_doc_pair, user: user)
      assert_equal 'This is a great match', judgement.explanation
    end

    test 'enqueues UpdateCaseRatingsJob' do
      assert_enqueued_with(job: UpdateCaseRatingsJob) do
        post book_judge_bulk_save_path(book),
             params: { query_doc_pair_id: query_doc_pair.id, rating: 3 },
             as: :json
      end
    end

    test 'returns error for invalid judgement' do
      # Force an error by using an invalid query_doc_pair_id
      post book_judge_bulk_save_path(book),
           params: { query_doc_pair_id: 999_999, rating: 3 },
           as: :json

      assert_response :not_found
    rescue ActiveRecord::RecordNotFound
      # This is expected behavior
    end
  end

  describe '#destroy' do
    test 'deletes an existing judgement' do
      judgement = Judgement.create!(
        query_doc_pair: query_doc_pair,
        user:           user,
        rating:         3
      )

      assert_difference 'Judgement.count', -1 do
        delete book_judge_bulk_destroy_path(book),
               params: { query_doc_pair_id: query_doc_pair.id },
               as: :json
      end

      assert_response :success
      json_response = JSON.parse(response.body)
      assert_equal 'success', json_response['status']
    end

    test 'returns error when judgement not found' do
      delete book_judge_bulk_destroy_path(book),
             params: { query_doc_pair_id: query_doc_pair.id },
             as: :json

      assert_response :not_found
      json_response = JSON.parse(response.body)
      assert_equal 'error', json_response['status']
      assert_not_nil json_response['message']
    end

    test 'enqueues UpdateCaseRatingsJob' do
      Judgement.create!(
        query_doc_pair: query_doc_pair,
        user:           user,
        rating:         3
      )

      assert_enqueued_with(job: UpdateCaseRatingsJob) do
        delete book_judge_bulk_destroy_path(book),
               params: { query_doc_pair_id: query_doc_pair.id },
               as: :json
      end
    end
  end

  describe 'pagination with empty book' do
    let(:empty_book) { books(:empty_book) }

    setup do
      # Create 30 QueryDocPairs for a single query_text, positions 1..30
      30.times do |i|
        QueryDocPair.create!(
          book:       empty_book,
          query_text: 'foo',
          position:   i + 1,
          doc_id:     "doc-#{i + 1}"
        )
      end
    end

    test 'gets 5 items on page 2' do
      Bullet.enable = false
      get book_judge_bulk_url(empty_book, page: 2, only_unrated: true)
      assert_response :success
      Bullet.enable = true

      # The controller should have backed up to page 1 and returned the 5 remaining unrated docs
      grouped = assigns(:grouped_query_doc_pairs)
      assert grouped.present?, 'Expected non-empty grouped results on page 2'

      # Flatten the grouped results to count items
      returned_items = grouped.values.flatten
      assert_equal 5, returned_items.size, 'Expected exactly 5 unrated docs on page 2'

      assert_equal 30, assigns(:total_count), 'Total count should be 30 unrated docs'
    end

    test 'backs up a page when page 2 has no unrated docs' do
      # Rate the first 25 docs by current_user to simulate that page 2 would be empty
      QueryDocPair.where(book: empty_book).order(:position).limit(25).each do |qdp|
        Judgement.create!(query_doc_pair: qdp, user: user, rating: 1)
      end

      # Request page 2 with only_unrated=true
      Bullet.enable = false
      get book_judge_bulk_url(empty_book, page: 2, only_unrated: true)
      assert_response :success
      Bullet.enable = true

      # The controller should have backed up to page 1 and returned the 5 remaining unrated docs
      grouped = assigns(:grouped_query_doc_pairs)
      assert grouped.present?, 'Expected non-empty grouped results after backing up a page'

      # Flatten the grouped results to count items
      returned_items = grouped.values.flatten
      assert_equal 5, returned_items.size, 'Expected exactly 5 unrated docs on backed-up page'

      # Ensure total_count reflects all unrated docs (30 total - 25 rated = 5)
      assert_equal 5, assigns(:total_count), 'Total count should be 5 unrated docs'
    end
  end
end
