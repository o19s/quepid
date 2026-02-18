# frozen_string_literal: true

module Api
  module V1
    module Import
      class RatingsController < Api::ApiController
        before_action :set_case
        before_action :check_case

        # rubocop:disable Metrics/MethodLength
        # rubocop:disable Metrics/AbcSize
        def create
          file_format = params[:file_format] || 'hash'
          file_format = 'hash' if file_format == 'csv'  # Client sends "csv" for pasted CSV (parsed to ratings)

          clear_queries = deserialize_bool_param(params[:clear_queries])

          case file_format
          when 'hash'
            # convert from ActionController::Parameters to a Hash, symbolize, and
            # then return just the ratings as an array.
            ratings = params.permit(ratings: [ :query_text, :doc_id, :rating ]).to_h.deep_symbolize_keys[:ratings] || []
          when 'rre'
            # normalize the RRE ratings format to the default hash format.
            ratings = []
            rre_json = begin
              JSON.parse(params[:rre_json] || '{}')
            rescue JSON::ParserError
              return render json: { message: "Invalid RRE JSON format" }, status: :bad_request
            end
            rre_json['queries']&.each do |rre_query|
              query_text = rre_query['placeholders']&.dig('$query')
              next if query_text.nil?

              if rre_query['relevant_documents'] # deal with if a query had no rated docs.
                rre_query['relevant_documents'].each do |rating_value, doc_ids|
                  doc_ids.each do |doc_id|
                    rating = {
                      query_text: query_text,
                      doc_id:     doc_id,
                      rating:     rating_value,
                    }
                    ratings << rating
                  end
                end
              else
                rating = {
                  query_text: query_text,
                  doc_id:     nil,
                  rating:     nil,
                }
                ratings << rating
              end
            end

          when 'ltr'
            # normalize the LTR ratings format to the default hash format.
            # Invalid lines are skipped (filter_map), matching ImportCaseRatingsJob and Core::ImportsController.
            ltr_text = params[:ltr_text] || ''
            ratings = ltr_text.split(/\n+/).filter_map { |line| rating_from_ltr_line(line) }
          end

          options = {
            format:         :hash,
            force:          true,
            clear_existing: clear_queries,
            show_progress:  false,
          }

          service = RatingsImporter.new @case, ratings, options

          begin
            service.import

            render json: { message: 'Success!' }, status: :ok
          rescue StandardError => e
            # TODO: report this to logging infrastructure so we won't lose any important
            # errors that we might have to fix.
            Rails.logger.debug { "Import ratings failed: #{e.inspect}" }

            render json: { message: e.message }, status: :bad_request
          end
        end

        def rating_from_ltr_line(ltr_line)
          # Pattern: 3 qid:1 # 1370 star trek
          # Returns nil for malformed lines (no space, no #, or missing doc_id/query separator).
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
        # rubocop:enable Metrics/MethodLength
        # rubocop:enable Metrics/AbcSize
      end
    end
  end
end
