# frozen_string_literal: true

require 'test_helper'

class BulkJudgeControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:random) }
  let(:book) { books(:empty_book) }

  setup do
    login_user_for_integration_test user

    # Create 30 QueryDocPairs for a single query_text, positions 1..30
    30.times do |i|
      QueryDocPair.create!(
        book:       book,
        query_text: 'foo',
        position:   i + 1,
        doc_id:     "doc-#{i + 1}"
      )
    end
  end

  test 'gets 5 items on page 2' do
    Bullet.enable = false
    get book_judge_bulk_url(book, page: 2, only_unrated: true)
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
    QueryDocPair.where(book: book).order(:position).limit(25).each do |qdp|
      Judgement.create!(query_doc_pair: qdp, user: user, rating: 1)
    end

    # Request page 2 with only_unrated=true
    Bullet.enable = false
    get book_judge_bulk_url(book, page: 2, only_unrated: true)
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
