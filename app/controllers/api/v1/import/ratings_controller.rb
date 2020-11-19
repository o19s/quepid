# frozen_string_literal: true

module Api
  module V1
    module Import
      class RatingsController < Api::ApiController
        before_action :find_case
        before_action :check_case

        # rubocop:disable Metrics/MethodLength
        # rubocop:disable Metrics/AbcSize
        # rubocop:disable Metrics/PerceivedComplexity
        def create
          file_format = params[:file_format]
          file_format = 'hash' unless params[:file_format]

          if 'hash' == file_format
            ratings = params[:ratings]
          elsif 'rre' == file_format
            # normalize the RRE ratings format to the default hash format.
            ratings = []
            rre_json = JSON.parse(params[:rre_json])
            rre_json['queries'].each do |rre_query|
              query_text = rre_query['placeholders']['$query']
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
          elsif 'ltr' == file_format
            # normalize the LTR ratings format to the default hash format.

            # What do we do about qid?  Do we assume that qid is in Quepid already?
            ratings = []
            ltr_text = params[:ltr_text]
            ltr_lines = ltr_text.split(/\n+/)

            ltr_lines.each do |ltr_line|
              rating = rating_from_ltr_line ltr_line
              ratings << rating
            end
          end

          options = {
            format:         :hash,
            force:          true,
            clear_existing: params[:clear_queries] || false,
          }

          service = RatingsImporter.new @case, ratings, options

          begin
            service.import

            render json: { message: 'Success!' }, status: :ok
          # rubocop:disable Lint/RescueException
          rescue Exception => e
            # TODO: report this to logging infrastructure so we won't lose any important
            # errors that we might have to fix.
            Rails.logger.debug "Import ratings failed: #{e.inspect}"

            render json: { message: e.message }, status: :bad_request
          end
          # rubocop:enable Lint/RescueException
        end
        # rubocop:enable Metrics/PerceivedComplexity

        def rating_from_ltr_line ltr_line
          # Pattern: 3 qid:1 # 1370 star trek
          ltr_line = ltr_line.strip
          first_chunk = ltr_line.index(' ')
          rating = ltr_line[0..first_chunk].strip
          ltr_line = ltr_line[first_chunk..-1].strip
          second_chunk_begin = ltr_line.index('#')
          ltr_line = ltr_line[second_chunk_begin + 1..-1].strip
          second_chunk_end = ltr_line.index(' ')
          doc_id = ltr_line[0..second_chunk_end].strip

          ltr_line = ltr_line[second_chunk_end..-1]

          query_text = ltr_line.strip

          rating = {
            query_text: query_text,
            doc_id:     doc_id,
            rating:     rating,
          }
          rating
        end
        # rubocop:enable Metrics/MethodLength
        # rubocop:enable Metrics/AbcSize
      end
    end
  end
end
