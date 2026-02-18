# frozen_string_literal: true

# Imports ratings into a case from the given params (CSV hash, RRE JSON, or LTR text).
# Broadcasts Turbo Stream notification when complete.
#
# @see Core::ImportsController
class ImportCaseRatingsJob < ApplicationJob
  queue_as :bulk_processing

  def perform(case_import_id)
    case_import = CaseImport.find_by(id: case_import_id)
    unless case_import
      Rails.logger.warn "ImportCaseRatingsJob: CaseImport #{case_import_id} not found"
      return
    end
    acase = case_import.case
    params = case_import.import_params.with_indifferent_access

    case_import.update(status: "import started at #{Time.zone.now}")

    broadcast_progress(acase, "Importing ratings...", 50)

    ratings = extract_ratings(params)
    options = {
      format: :hash,
      force: true,
      clear_existing: params[:clear_queries],
      show_progress: false
    }

    service = RatingsImporter.new(acase, ratings, options)
    service.import

    case_import.update(status: "completed")
    broadcast_complete(acase)
    case_import.destroy
  rescue StandardError => e
    case_import&.update(status: "failed: #{e.message}")
    broadcast_error(case_import&.case, e.message) if case_import&.case
    raise
  end

  private

  def extract_ratings(params)
    format = params[:format].to_s
    format = 'hash' if format == 'csv'  # Defensive: csv maps to hash (client parses CSV to ratings)
    case format
    when 'hash'
      params[:ratings] || []
    when 'rre'
      ratings = []
      rre_json = JSON.parse(params[:rre_json] || '{}')
      rre_json['queries']&.each do |rre_query|
        query_text = rre_query['placeholders']&.dig('$query')
        if rre_query['relevant_documents']
          rre_query['relevant_documents'].each do |rating_value, doc_ids|
            doc_ids.each do |doc_id|
              ratings << { query_text: query_text, doc_id: doc_id, rating: rating_value }
            end
          end
        else
          ratings << { query_text: query_text, doc_id: nil, rating: nil }
        end
      end
      ratings
    when 'ltr'
      (params[:ltr_text] || '').split(/\n+/).filter_map { |line| rating_from_ltr_line(line) }
    else
      []
    end
  end

  def rating_from_ltr_line(ltr_line)
    ltr_line = ltr_line.strip
    first_chunk = ltr_line.index(' ')
    return nil unless first_chunk

    rating = ltr_line[0..first_chunk].strip
    ltr_line = ltr_line[first_chunk..].strip
    second_chunk_begin = ltr_line.index('#')
    return nil unless second_chunk_begin

    ltr_line = ltr_line[(second_chunk_begin + 1)..].strip
    second_chunk_end = ltr_line.index(' ')
    return nil unless second_chunk_end

    doc_id = ltr_line[0..second_chunk_end].strip
    query_text = ltr_line[second_chunk_end..].strip

    { query_text: query_text, doc_id: doc_id, rating: rating }
  end

  def broadcast_progress(acase, message, progress)
    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target: "notifications-case-#{acase.id}",
      partial: "core/imports/notification",
      locals: { acase: acase, message: message, progress: progress }
    )
  end

  def broadcast_complete(acase)
    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target: "notifications-case-#{acase.id}",
      partial: "core/imports/notification_complete",
      locals: { acase: acase }
    )
  end

  def broadcast_error(acase, message)
    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target: "notifications-case-#{acase.id}",
      partial: "core/imports/notification_error",
      locals: { acase: acase, message: message }
    )
  end
end
