# frozen_string_literal: true

require 'test_helper'

class ImportBookJobTest < ActiveJob::TestCase
  let(:book) { books(:empty_book) }
  let(:user) { users(:random) }

  def attach_import_file book, data
    serialized_data = Marshal.dump(data)
    compressed_data = Zlib::Deflate.deflate(serialized_data)

    book.import_file.attach(
      io:           StringIO.new(compressed_data),
      filename:     "book_import_#{book.id}.bin.zip",
      content_type: 'application/zip'
    )
    book.save!
  end

  describe 'importing a book from an uploaded file' do
    test 'processes the marshalled data, creating query_doc_pairs and judgements' do
      test_data = {
        name:              'Imported Book',
        scale:             '0,1',
        scale_with_labels: '{"0": "Not Relevant", "1": "Relevant"}',
        query_doc_pairs:   [
          {
            query_text:      'imported query',
            doc_id:          'doc_1',
            position:        0,
            document_fields: { title: 'Doc 1' },
            judgements:      [
              { user_email: user.email, rating: 1 }
            ],
          }
        ],
      }

      attach_import_file book, test_data

      assert_difference 'book.query_doc_pairs.count', 1 do
        ImportBookJob.perform_now user, book
      end

      book.reload
      assert_equal 'Imported Book', book.name
      assert_equal user, book.owner
      assert_nil book.import_job

      query_doc_pair = book.query_doc_pairs.find_by(query_text: 'imported query', doc_id: 'doc_1')
      assert_not_nil query_doc_pair
      assert_equal 1, query_doc_pair.judgements.count
      assert_equal 1, query_doc_pair.judgements.first.rating

      # the uploaded file is purged once the import finishes
      assert_not book.import_file.attached?
    end

    test 'handles data with no query_doc_pairs without error' do
      test_data = {
        name:  'Book With No Pairs',
        scale: '0,1',
      }

      attach_import_file book, test_data

      assert_no_difference 'QueryDocPair.count' do
        ImportBookJob.perform_now user, book
      end

      book.reload
      assert_equal 'Book With No Pairs', book.name
      assert_nil book.import_job
      assert_not book.import_file.attached?
    end
  end
end
