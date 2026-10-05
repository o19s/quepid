# frozen_string_literal: true

require 'test_helper'

class ApplicationJobTest < ActiveJob::TestCase
  test 'discards rather than raises when a record argument is deleted before the job runs' do
    query_doc_pair = QueryDocPair.create!(query_text: 'temp', doc_id: 'temp', book: books(:book_of_star_wars_judgements))
    UpdateCaseRatingsJob.perform_later(query_doc_pair)
    query_doc_pair.destroy

    assert_nothing_raised do
      perform_enqueued_jobs
    end
  end

  describe '.safely_locate' do
    it 'resolves a GlobalID to its record' do
      book = books(:book_of_star_wars_judgements)

      assert_equal book, ApplicationJob.safely_locate(book.to_global_id.to_s)
    end

    it 'returns nil instead of raising for a GlobalID whose record is gone' do
      book = books(:book_of_star_wars_judgements)
      query_doc_pair = QueryDocPair.create!(query_text: 'temp', doc_id: 'temp', book: book)
      gid = query_doc_pair.to_global_id.to_s
      query_doc_pair.destroy

      assert_nil ApplicationJob.safely_locate(gid)
    end
  end
end
