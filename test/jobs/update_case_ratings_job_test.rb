# frozen_string_literal: true

require 'test_helper'

class UpdateCaseRatingsJobTest < ActiveJob::TestCase
  let(:user)                  { users(:random_1) }
  let(:matt)                  { users(:matt) }
  let(:case_with_book) { cases(:case_with_book) }
  let(:book) { books(:book_of_star_wars_judgements) }

  test 'account is charged' do
    case_with_book.queries << Query.create(query_text: 'my search')

    query_doc_pair = QueryDocPair.create(query_text: 'my search', doc_id: 'DOC123456')
    book.query_doc_pairs << query_doc_pair
    book.save

    Judgement.create(query_doc_pair: query_doc_pair, rating: 4.0, user: user)

    assert_difference 'case_with_book.ratings.count', 1 do
      perform_enqueued_jobs do
        UpdateCaseRatingsJob.perform_now(query_doc_pair)
      end
    end
    rating = case_with_book.queries.where(query_text: 'my search').first.ratings.where(doc_id: 'DOC123456').first
    assert_in_delta(4.0, rating.rating)

    Judgement.create(query_doc_pair: query_doc_pair, rating: 1.0, user: matt)

    assert_difference 'case_with_book.ratings.count', 0 do
      perform_enqueued_jobs do
        UpdateCaseRatingsJob.perform_now(query_doc_pair)
      end
    end
    rating = case_with_book.queries.where(query_text: 'my search').first.ratings.where(doc_id: 'DOC123456').first
    assert_in_delta(3.0, rating.rating)
  end
end
