# frozen_string_literal: true

require 'csv'

# Handles case import (ratings, information needs) from the web UI.
# Uses background job for large imports; sync for small. API remains for external consumers.
#
# @see ImportCaseRatingsJob
module Core
  class ImportsController < ApplicationController
    include Authentication::CurrentUserManager
    include Authentication::CurrentCaseManager

    before_action :set_case_from_id
    before_action :set_try
    before_action :check_case

    respond_to :html, :turbo_stream

    ASYNC_RATINGS_THRESHOLD = 50

    # POST /case/:id/import/ratings
    # Imports ratings (CSV, RRE, LTR). Sync for small; async job for large.
    def ratings
      format = params[:file_format] || 'hash'
      format = 'hash' if format == 'csv'  # Client sends "csv" for pasted CSV (parsed to ratings)
      clear_queries = deserialize_bool_param(params[:clear_queries])

      ratings = extract_ratings(format)
      if ratings.nil?
        return render_error("Invalid format or missing data")
      end

      if ratings.size > ASYNC_RATINGS_THRESHOLD
        case_import = CaseImport.create!(
          case: @case,
          user: current_user,
          import_params: build_import_params(format, ratings, clear_queries),
          status: "pending"
        )
        ImportCaseRatingsJob.perform_later(case_import.id)

        respond_to do |fmt|
          fmt.turbo_stream do
            render turbo_stream: turbo_stream.append(
              "flash",
              partial: "shared/flash_alert",
              locals: { message: "Import started (#{ratings.size} ratings). You will be notified when complete." }
            ), status: :accepted
          end
          fmt.html { redirect_to case_core_path(@case, @try), notice: "Import started." }
        end
      else
        import_sync(format, ratings, clear_queries)
      end
    end

    # POST /case/:id/import/information_needs
    # Imports information needs from CSV. Always sync (typically small).
    def information_needs
      csv_text = params[:csv_text].to_s.strip
      create_queries = deserialize_bool_param(params[:create_queries])

      if csv_text.blank?
        return render_error("Please provide CSV content (query,information_need)")
      end

      csv_data = CSV.parse(csv_text, liberal_parsing: true)
      headers = csv_data.shift&.map(&:to_s) || []
      data = csv_data.map { |row| Hash[*headers.zip(row.map(&:to_s)).flatten] }

      missing_queries = data.filter_map { |row| row['query'] }.uniq - @case.queries.pluck(:query_text)
      if create_queries
        missing_queries.each { |q| @case.queries.create!(query_text: q) }
        missing_queries = []
      end

      unless missing_queries.empty?
        return render_error("Didn't find #{missing_queries.count} query(ies): #{missing_queries.to_sentence}")
      end

      data.each do |row|
        query = @case.queries.find_by(query_text: row['query'])
        query&.update!(information_need: row['information_need'])
      end

      respond_to do |format|
        format.turbo_stream do
          render turbo_stream: turbo_stream.append(
            "flash",
            partial: "shared/flash_alert",
            locals: { message: "Successfully imported information needs." }
          ), status: :ok
        end
        format.html { redirect_to case_core_path(@case, @try), notice: "Information needs imported." }
      end
    rescue StandardError => e
      Rails.logger.error("ImportsController#information_needs: #{e.class} - #{e.message}\n#{e.backtrace.first(5).join("\n")}")
      render_error(e.message)
    end

    private

    def set_case_from_id
      params[:case_id] = params[:id]
      set_case
    end

    def extract_ratings(format)
      case format.to_s
      when 'hash'
        raw = params[:ratings]
        if raw.is_a?(String)
          parsed = begin
            JSON.parse(raw)
          rescue JSON::ParserError
            return nil
          end
          parsed.map(&:with_indifferent_access)
        else
          params.permit(ratings: [ :query_text, :doc_id, :rating ]).to_h[:ratings]&.map(&:to_h) || []
        end
      when 'rre'
        return nil unless params[:rre_json].present?
        ratings = []
        rre = begin
          JSON.parse(params[:rre_json])
        rescue JSON::ParserError
          return nil
        end
        rre['queries']&.each do |q|
          query_text = q['placeholders']&.dig('$query')
          if q['relevant_documents']
            q['relevant_documents'].each do |rating_value, doc_ids|
              doc_ids.each { |doc_id| ratings << { query_text: query_text, doc_id: doc_id, rating: rating_value } }
            end
          else
            ratings << { query_text: query_text, doc_id: nil, rating: nil }
          end
        end
        ratings
      when 'ltr'
        return nil unless params[:ltr_text].present?
        params[:ltr_text].split(/\n+/).filter_map { |line| rating_from_ltr_line(line) }
      else
        nil
      end
    end

    def rating_from_ltr_line(line)
      line = line.strip
      first = line.index(' ')
      return nil unless first
      rating = line[0..first].strip
      line = line[first..].strip
      hash_pos = line.index('#')
      return nil unless hash_pos
      line = line[(hash_pos + 1)..].strip
      space_pos = line.index(' ')
      return nil unless space_pos
      doc_id = line[0..space_pos].strip
      query_text = line[space_pos..].strip
      { query_text: query_text, doc_id: doc_id, rating: rating }
    end

    def build_import_params(format, ratings, clear_queries)
      base = { format: format, clear_queries: clear_queries }
      case format
      when 'hash' then base.merge(ratings: ratings)
      when 'rre' then base.merge(rre_json: params[:rre_json])
      when 'ltr' then base.merge(ltr_text: params[:ltr_text])
      else base
      end
    end

    def import_sync(format, ratings, clear_queries)
      options = { format: :hash, force: true, clear_existing: clear_queries, show_progress: false }
      service = RatingsImporter.new(@case, ratings, options)
      service.import

      respond_to do |fmt|
        fmt.turbo_stream do
          render turbo_stream: turbo_stream.append(
            "flash",
            partial: "shared/flash_alert",
            locals: { message: "Successfully imported #{ratings.size} ratings." }
          ), status: :ok
        end
        fmt.html { redirect_to case_core_path(@case, @try), notice: "Ratings imported." }
      end
    rescue StandardError => e
      Rails.logger.error("ImportsController#import_sync: #{e.class} - #{e.message}\n#{e.backtrace.first(5).join("\n")}")
      render_error(e.message)
    end

    def set_try
      @try = @case.tries.latest
    end

    def render_error(message)
      respond_to do |format|
        format.turbo_stream do
          render turbo_stream: turbo_stream.append(
            "flash",
            partial: "shared/flash_alert",
            locals: { message: message }
          ), status: :unprocessable_entity
        end
        format.html { redirect_to case_core_path(@case, @try), alert: message }
      end
    end
  end
end
