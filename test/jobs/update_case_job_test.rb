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
end
