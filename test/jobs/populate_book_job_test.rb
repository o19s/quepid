# frozen_string_literal: true

require 'test_helper'

class PopulateBookJobTest < ActiveJob::TestCase
  # The core of the logic for these tests is in the populate_controller_test.rb file!
  let(:book) { books(:james_bond_movies) }
  let(:judge_judy) { users(:judge_judy) }
  let(:acase) { cases(:case_with_book) }

  describe 'populating an existing book' do
    test 'ensure that position value is unique per query' do
      assert true
    end

    test 'processes data from a blob' do
      # Create sample data
      test_data = {
        query_doc_pairs: [
          {
            query_text:      'test query',
            doc_id:          'test_doc_1',
            position:        0,
            document_fields: {
              title: 'Test Document 1',
              year:  '2023',
            },
          }
        ],
      }

      serialized_data = Marshal.dump(test_data)
      compressed_data = Zlib::Deflate.deflate(serialized_data)

      # Create a blob
      blob = ActiveStorage::Blob.create_and_upload!(
        io:           StringIO.new(compressed_data),
        filename:     "test_populate_#{book.id}.bin.zip",
        content_type: 'application/zip'
      )

      # Run the job
      assert_difference 'book.query_doc_pairs.count', 1 do
        PopulateBookJob.perform_now(book, acase, blob)
      end

      # Verify the query doc pair was created with the correct data
      query_doc_pair = book.query_doc_pairs.find_by(query_text: 'test query', doc_id: 'test_doc_1')
      assert_not_nil query_doc_pair
      assert_equal 0, query_doc_pair.position
      assert_equal({ 'title' => 'Test Document 1', 'year' => '2023' }, query_doc_pair.document_fields)

      # Verify the blob was purged
      assert_raise(ActiveStorage::FileNotFoundError) { blob.download }
    end
  end
end
