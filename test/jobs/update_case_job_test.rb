# frozen_string_literal: true

require 'test_helper'

class UpdateCaseJobTest < ActiveJob::TestCase
  let(:user) { users(:matt) }
  let(:case_with_book) { cases(:case_with_book) }
  let(:book) { books(:book_of_star_wars_judgements) }

  test 'change to book is pushed to case' do
    assert case_with_book.ratings.empty?

    assert_difference 'case_with_book.ratings.count', 2 do
      perform_enqueued_jobs do
        UpdateCaseJob.perform_now book, {}, case_with_book
      end
    end

    assert_not case_with_book.ratings.empty?
  end
end
