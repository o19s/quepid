# frozen_string_literal: true

class PopulateBookJob < ApplicationJob
  queue_as :bulk_processing

  # NOTE: Duplicate prevention is handled on the client side in queriesSvc.syncToBook
  # which maintains a cache of already-synced query-doc pairs and only sends new ones.
  # Queries are batched in groups of 100 for efficiency.

  # rubocop:disable Security/MarshalLoad
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/AbcSize
  def perform book, kase, blob
    # Using Rails' bulk insert methods for better performance.

    book.update(populate_job: "populate started at #{Time.zone.now}")
    compressed_data = blob.download
    serialized_data = Zlib::Inflate.inflate(compressed_data)
    params = Marshal.load(serialized_data)

    book.query_doc_pairs.empty?

    total = params[:query_doc_pairs].size
    counter = total
    last_percent = 0
    params[:query_doc_pairs].each do |pair|
      counter -= 1
      query_doc_pair = book.query_doc_pairs.find_or_create_by query_text: pair[:query_text],
                                                              doc_id:     pair[:doc_id]
      query_doc_pair.position = pair[:position]
      query_doc_pair.document_fields = pair[:document_fields].to_json

      query = kase.queries.find_by(query_text: query_doc_pair.query_text)

      if query # the query may no longer exist in the case

        query_doc_pair.information_need = query.information_need
        query_doc_pair.notes = query.notes
        query_doc_pair.options = query.options

        # At one time we copied ratings over to the judgements based on your user_id
        # however what do you do when you change the rating as a individual and then do it.
        # We also have a JudgementFromRatingJob that does it as it happens when you call the ratings_controller.rb

        # if pair[:rating]
        #   rating = query.ratings.find_by(doc_id: query_doc_pair.doc_id)

        #   # we are smart and just look up the correct user id from rating.user_id via the database, no API data needed.
        #   if rating.user_id
        #     judgement = query_doc_pair.judgements.find_or_create_by user_id: rating.user_id
        #     judgement.rating = pair[:rating]
        #     # judgement.user = User.find(pair[:user_id]) # rating.user
        #     judgement.save!
        #   end
        # end

        # don't overload the database with updates when nothing changed
        if query_doc_pair.changed?
          # Rails.logger.info "Changes detected for QueryDocPair ##{query_doc_pair.id} (#{query_doc_pair.query_text}/#{query_doc_pair.doc_id}):"
          # Rails.logger.info "  Changed attributes: #{query_doc_pair.changed.join(', ')}"

          # # Show detailed changes with before/after values
          # Rails.logger.info "  Changes details:"
          # query_doc_pair.changes.each do |attribute, changes|
          #   old_value, new_value = changes
          #   Rails.logger.info "    #{attribute}: #{old_value.inspect} → #{new_value.inspect}"
          # end

          query_doc_pair.save!
        end
      end

      # emit a message every percent that we cross, from 0 to 100...
      percent = (((total - counter).to_f / total) * 100).truncate
      next unless percent > last_percent

      last_percent = percent
      Turbo::StreamsChannel.broadcast_render_to(
        :notifications,
        target:  'notifications',
        partial: 'books/blah',
        locals:  { book: book, counter: counter, percent: percent, qdp: query_doc_pair }
      )
    end

    fix_duplicate_positions book

    # Clean up the blob as it's no longer needed
    blob.purge
    book.populate_job = nil
    book.save
  end
  # rubocop:enable Security/MarshalLoad
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/AbcSize

  def fix_duplicate_positions book
    duplicates = book.query_doc_pairs.group(:query_text, :position)
      .having('COUNT(*) > 1')
      .select(:query_text, :position)

    duplicates.each do |duplicate|
      pairs = book.query_doc_pairs.where(query_text: duplicate.query_text,
                                         position:   duplicate.position)
        .order(updated_at: :desc)

      # Skip the first (newest) one and clear position field for the rest
      pairs.offset(1).update_all(position: nil)
    end
  end
  # rubocop:enable Rails/SkipsModelValidations
end
