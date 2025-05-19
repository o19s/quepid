# frozen_string_literal: true

require 'csv'

module Api
  module V1
    module Export
      class RatingsController < Api::ApiController
        before_action :set_case
        before_action :check_case

        # rubocop:disable Metrics/MethodLength
        # rubocop:disable Metrics/AbcSize
        # rubocop:disable Metrics/CyclomaticComplexity
        # rubocop:disable Metrics/PerceivedComplexity
        # rubocop:disable Metrics/BlockLength
        def show
          file_format = params[:file_format]

          respond_to do |format|
            format.json do
              json_template = file_format.nil? ? 'show' : "show_#{file_format.downcase}"

              render json_template, formats: :json
            end
            format.csv do
              # We have crazy rendering formatting in the view because we don't want a trailing LF at the end of the
              # CSV, it messes with Quaerite, however the render() call adds a LF, so we need to format our CSV with
              # line feeds on each line except the very last one!

              @csv_array = []
              csv_headers = %w[query docid rating]
              @csv_array << csv_headers

              if 'basic_snapshot' == file_format
                csv_filename = "case_#{@case.id}_snapshot_judgements.csv"
                snapshot = @case.snapshots.find_by(id: params[:snapshot_id])

                snapshot.snapshot_queries.each do |snapshot_query|
                  if snapshot_query.snapshot_docs.empty?
                    @csv_array << [ make_csv_safe(snapshot_query.query.query_text) ]
                  else
                    snapshot_query.snapshot_docs.each do |snapshot_doc|
                      rating = Rating.find_by(query_id: snapshot_query.query.id, doc_id: snapshot_doc.doc_id)
                      @csv_array << [ make_csv_safe(snapshot_query.query.query_text), snapshot_doc.doc_id,
                                      rating.nil? ? nil : rating.rating ]
                    end
                  end
                end

              else
                csv_filename = "case_#{@case.id}_judgements.csv"

                @case.queries.each do |query|
                  if query.ratings.fully_rated.empty?
                    @csv_array << [ make_csv_safe(query.query_text) ]
                  else
                    query.ratings.fully_rated.each do |rating|
                      @csv_array << [ make_csv_safe(query.query_text), rating.doc_id, rating.rating ]
                    end
                  end
                end
              end

              # pad out each row so we get three columns in our resulting CSV.
              @csv_array.each do |row|
                padright!(row, 3, nil)
              end

              headers['Content-Disposition'] = "attachment; filename=\"#{csv_filename}\""
              headers['Content-Type'] ||= 'text/csv'
            end
            format.txt do
              @snapshot = @case.snapshots.find_by(id: params[:snapshot_id]) if 'trec_snapshot' == file_format
              headers['Content-Disposition'] = "attachment; filename=\"case_#{@case.id}_#{file_format}.txt\""
              headers['Content-Type'] ||= 'text/plain'

              text_template = file_format.nil? ? 'show' : "show_#{file_format.downcase}"
              render text_template, formats: :txt
            end
          end
        end
        # rubocop:enable Metrics/MethodLength
        # rubocop:enable Metrics/AbcSize
        # rubocop:enable Metrics/CyclomaticComplexity
        # rubocop:enable Metrics/PerceivedComplexity
        # rubocop:enable Metrics/BlockLength

        def make_csv_safe str
          if %w[- = + @].include?(str[0])
            " #{str}"
          else
            str
          end
        end

        private

        # https://stackoverflow.com/questions/5608918/pad-an-array-to-be-a-certain-size
        # rubocop:disable Naming/MethodParameterName
        def padright! a, n, x
          a.fill(x, a.length...n)
        end
        # rubocop:enable Naming/MethodParameterName
      end
    end
  end
end
