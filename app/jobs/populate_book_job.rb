# frozen_string_literal: true

class PopulateBookJob < ApplicationJob
  queue_as :default
  sidekiq_options log_level: :warn

  # rubocop:disable Security/MarshalLoad
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/AbcSize
  def perform user, book, kase
    # down the road we should be using ActiveRecord-import and first_or_initialize instead.
    # See how snapshots are managed.

    compressed_data = book.populate_file.download
    serialized_data = Zlib::Inflate.inflate(compressed_data)
    params = Marshal.load(serialized_data)

    puts "[PopulateBookJob] I am going to populate the book with #{params[:query_doc_pairs].size} Query doc pairs"

    is_book_empty = book.query_doc_pairs.empty?

    params[:query_doc_pairs].each do |pair|
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
    end
    book.populate_file.purge
    book.save

    RunJudgeJudyJob.perform_later book

    Analytics::Tracker.track_query_doc_pairs_bulk_updated_event user, book, is_book_empty
  end
  # rubocop:enable Security/MarshalLoad
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/AbcSize
end
