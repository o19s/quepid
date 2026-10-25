# frozen_string_literal: true

require 'test_helper'
require 'zip'

class ExportBookJobTest < ActiveJob::TestCase
  include Turbo::Broadcastable::TestHelper

  let(:book) { books(:james_bond_movies) }

  test 'export the book works' do
    book.update!(export_job: 'queued')
    assert_not book.export_file.attached?

    ExportBookJob.perform_now(book)

    assert_nil book.reload.export_job
    assert_predicate book.export_file, :attached?

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

  test 'broadcasts the download link to the export page when it finishes' do
    streams = capture_turbo_stream_broadcasts([ book, :export ]) do
      ExportBookJob.perform_now(book)
    end

    assert_equal([ "export_status_book_#{book.id}" ] * 2, streams.map { |stream| stream['target'] })
    assert_includes streams.first.text, 'currently being exported'
    assert_includes streams.last.text, 'available to download'
    assert_equal 'Re-Export', streams.last.at_css('button').text.strip
  end

  test 'the completion notice links to the export tab' do
    streams = capture_turbo_stream_broadcasts([ book.owner, :notifications ]) do
      ExportBookJob.perform_now(book)
    end

    assert_equal "/books/#{book.id}/export", streams.last.at_css('a')['href']
  end

  test 'a failed export clears the in-progress state and tells the export page' do
    book.update!(export_job: 'queued')
    failing_job = ExportBookJob.new(book)
    failing_job.define_singleton_method(:create_zip_from_json) { |*| raise 'boom' }

    streams = capture_turbo_stream_broadcasts([ book, :export ]) do
      assert_raises(RuntimeError) { failing_job.perform_now }
    end

    assert_nil book.reload.export_job
    assert_not book.export_file.attached?
    assert_includes streams.last.text, 'The last export failed'
    assert_equal 'Export', streams.last.at_css('button').text.strip
  end
end
