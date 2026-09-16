# frozen_string_literal: true

require 'test_helper'

class JudgementFromRatingJobTest < ActiveJob::TestCase
  let(:user) { users(:random) }
  let(:query_with_book) { queries(:query2_for_case_with_book) }
  let(:book) { books(:book_of_star_wars_judgements) }

  describe 'a rating on a query whose case has a book' do
    test 'reuses an existing query_doc_pair and creates a judgement with the rating value' do
      rating = Rating.create! query: query_with_book, doc_id: 'Han Solo-A Star Wars Story', rating: 2, user: user

      assert_no_difference 'QueryDocPair.count' do
        JudgementFromRatingJob.perform_now user, rating
      end

      query_doc_pair = book.query_doc_pairs.find_by(query_text: query_with_book.query_text,
                                                    doc_id:     'Han Solo-A Star Wars Story')
      assert_not_nil query_doc_pair

      judgement = query_doc_pair.judgements.find_by(user: user)
      assert_not_nil judgement
      assert_equal 2, judgement.rating
    end

    test 'creates a new query_doc_pair when the doc_id is not already tracked in the book' do
      rating = Rating.create! query: query_with_book, doc_id: 'a_brand_new_doc', rating: 3, user: user

      assert_difference 'QueryDocPair.count', 1 do
        JudgementFromRatingJob.perform_now user, rating
      end

      query_doc_pair = book.query_doc_pairs.find_by(query_text: query_with_book.query_text, doc_id: 'a_brand_new_doc')
      assert_not_nil query_doc_pair

      judgement = query_doc_pair.judgements.find_by(user: user)
      assert_not_nil judgement
      assert_equal 3, judgement.rating
    end

    test 're-running the job for the same user and rating updates the existing judgement instead of duplicating it' do
      rating = Rating.create! query: query_with_book, doc_id: 'yet_another_new_doc', rating: 1, user: user

      assert_difference 'Judgement.count', 1 do
        JudgementFromRatingJob.perform_now user, rating
      end

      rating.update! rating: 4

      assert_no_difference 'Judgement.count' do
        JudgementFromRatingJob.perform_now user, rating
      end

      query_doc_pair = book.query_doc_pairs.find_by(query_text: query_with_book.query_text, doc_id: 'yet_another_new_doc')
      judgement = query_doc_pair.judgements.find_by(user: user)
      assert_equal 4, judgement.rating
    end
  end

  describe 'a rating on a query whose case has no book' do
    test 'is a no-op, since there is nowhere to store the judgement' do
      rating = ratings(:import_rating_1)

      assert_nil rating.query.case.book

      assert_no_difference [ 'QueryDocPair.count', 'Judgement.count' ] do
        JudgementFromRatingJob.perform_now user, rating
      end
    end
  end
end
