# frozen_string_literal: true

class PopulateBookJob < ApplicationJob
  queue_as :bulk_processing

  # rubocop:disable Security/MarshalLoad
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/AbcSize
  def perform book, kase
    # down the road we should be using ActiveRecord-import and first_or_initialize instead.
    # See how snapshots are managed.

    book.update(populate_job: "populate started at #{Time.zone.now}")
    compressed_data = book.populate_file.download
    serialized_data = Zlib::Inflate.inflate(compressed_data)
    params = Marshal.load(serialized_data)

    counter = params[:query_doc_pairs].size
    params[:query_doc_pairs].each do |pair|
      counter -= 1
      query_doc_pair = book.query_doc_pairs.find_or_create_by query_text: pair[:query_text],
                                                              doc_id:     pair[:doc_id]
      query_doc_pair.position = pair[:position]
      query_doc_pair.document_fields = pair[:document_fields].to_json

      query = kase.queries.find_by(query_text: query_doc_pair.query_text)

      query_doc_pair.information_need = query.information_need
      query_doc_pair.notes = query.notes
      query_doc_pair.options = query.options

      if pair[:rating]
        rating = query.ratings.find_by(doc_id: query_doc_pair.doc_id)

        # we are smart and just look up the correct user id from rating.user_id via the database, no API data needed.
        judgement = query_doc_pair.judgements.find_or_create_by user_id: rating.user_id
        judgement.rating = pair[:rating]
        judgement.user = User.find(pair[:user_id]) # rating.user
        judgement.save!
      end

      query_doc_pair.save!

      Turbo::StreamsChannel.broadcast_render_to(
        :notifications,
        target:  'notifications',
        partial: 'books/blah',
        locals:  { book: book, counter: counter, qdp: query_doc_pair }
      )
    end
    book.populate_file.purge
    book.populate_job = nil
    book.save
  end
  # rubocop:enable Security/MarshalLoad
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/AbcSize
end
