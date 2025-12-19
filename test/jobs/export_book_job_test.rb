# frozen_string_literal: true

require 'test_helper'
require 'zip'

class ExportBookJobTest < ActiveJob::TestCase
  let(:book) { books(:james_bond_movies) }

  test 'export the book works' do
    assert_nil book.export_job
    assert_not book.export_file.attached?

    perform_enqueued_jobs do
      ExportBookJob.perform_now(book)
      # assert_not_nil book.export_job
    end

    assert_nil book.export_job
    assert book.export_file.attached?

    # Get the Active Storage attachment
    attachment = book.export_file

    # Get the path to the temporary file
    file_path = attachment.service.path_for(attachment.key)

    # Extract the first file from the zip
    Zip::File.open(file_path) do |zip_file|
      first_entry = zip_file.entries.first
      body = JSON.parse(first_entry.get_input_stream.read)
      assert_nil body['book_id']
      assert_not_nil body['name']

      assert_nil body['scorer_id']
      assert_not_nil body['scale']
      assert_not_nil body['scale_with_labels']
    end
  end
end
