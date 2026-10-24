# frozen_string_literal: true

require 'test_helper'

class UpdateCaseJobTest < ActiveJob::TestCase
  let(:user) { users(:matt) }
  let(:case_with_book) { cases(:case_with_book) }
  let(:book) { books(:book_of_star_wars_judgements) }

  test 'change to book is pushed to case' do
    assert_empty case_with_book.ratings

    assert_difference 'case_with_book.ratings.count', 2 do
      perform_enqueued_jobs do
        UpdateCaseJob.perform_now book, {}, case_with_book
      end
    end

    assert_not case_with_book.ratings.empty?
  end

  test 'bulk update skips cases with auto_populate_case_judgements disabled' do
    case_with_book.update!(auto_populate_case_judgements: false)

    assert_no_difference 'case_with_book.ratings.count' do
      perform_enqueued_jobs do
        UpdateCaseJob.perform_now book
      end
    end
  end

  test 'bulk update syncs cases with auto_populate_case_judgements enabled' do
    case_with_book.update!(auto_populate_case_judgements: true)

    assert_difference 'case_with_book.ratings.count', 2 do
      perform_enqueued_jobs do
        UpdateCaseJob.perform_now book
      end
    end
  end

  test 'explicit case refresh always runs regardless of flag' do
    case_with_book.update!(auto_populate_case_judgements: false)

    assert_difference 'case_with_book.ratings.count', 2 do
      perform_enqueued_jobs do
        UpdateCaseJob.perform_now book, {}, case_with_book
      end
    end
  end

  test 'reports cumulative creation totals once across cases with different missing records' do
    case_with_book.update!(auto_populate_case_judgements: true)
    other_case = Case.create!(case_name: 'Second refresh case', owner: user, book: book,
                              auto_populate_case_judgements: true)
    pairs = 2.times.map do |index|
      pair = book.query_doc_pairs.create!(query_text: "Refresh count #{index}", doc_id: "count_#{index}")
      pair.judgements.create!(user: user, rating: 1)
      pair
    end
    pair = pairs.first
    query = other_case.queries.create!(query_text: pair.query_text)
    query.ratings.create!(doc_id: pair.doc_id, rating: 0)

    queries_before = Query.count
    ratings_before = Rating.count
    counts = UpdateCaseJob.perform_now(book, create_missing_queries: true)

    assert_operator Query.count - queries_before, :>, 0
    assert_operator Rating.count - ratings_before, :>, 0
    assert_equal Query.count - queries_before, counts['queries_created']
    assert_equal Rating.count - ratings_before, counts['ratings_created']
    assert_equal({ 'queries_created' => 0, 'ratings_created' => 0 },
                 UpdateCaseJob.perform_now(book, create_missing_queries: true))
  end
end
