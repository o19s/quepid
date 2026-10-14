# frozen_string_literal: true

require 'csv'

module Api
  module V1
    module Export
      class RatingsController < Api::ApiController
        TEXT_TYPE = 'text/plain; charset=utf-8'

        before_action :set_case

        def show
          file_format = params[:file_format]

          respond_to do |format|
            format.json do
              json_template = file_format.nil? ? 'show' : "show_#{file_format.downcase}"

              render json_template, formats: :json
            end
            format.csv do
              prepare_csv(file_format)
            end
            format.txt do
              case file_format&.downcase
              when 'trec'
                send_data TrecExport.generate_for_case(@case), filename: "case_#{@case.id}_trec.txt", type: TEXT_TYPE
              when 'trec_snapshot'
                snapshot = @case.snapshots.find_by(id: params[:snapshot_id])
                return head :not_found unless snapshot

                send_data TrecExport.generate_for_snapshot(snapshot),
                          filename: "case_#{@case.id}_trec_snapshot.txt", type: TEXT_TYPE
              when 'ltr'
                send_data LtrExport.generate_for_case(@case), filename: "case_#{@case.id}_ltr.txt", type: TEXT_TYPE
              else
                head :bad_request
              end
            end
          end
        end

        def make_csv_safe str
          CsvExport.field(str)
        end

        private

        def prepare_csv file_format
          # Quaerite breaks on a blank last line (#354); CsvExport.generate ends with exactly one LF.
          @csv_array = [ %w[query docid rating] ]
          if 'basic_snapshot' == file_format
            csv_filename = "case_#{@case.id}_snapshot_judgements.csv"
            append_snapshot_csv_rows
          else
            csv_filename = "case_#{@case.id}_judgements.csv"
            append_case_csv_rows
          end

          # pad out each row so we get three columns in our resulting CSV.
          @csv_array.each { |row| padright!(row, 3, nil) }
          send_data CsvExport.generate(@csv_array), filename: csv_filename, type: 'text/csv'
        end

        def append_snapshot_csv_rows
          snapshot = @case.snapshots.find_by(id: params[:snapshot_id])

          snapshot.snapshot_queries.each do |snapshot_query|
            if snapshot_query.snapshot_docs.empty?
              @csv_array << [ make_csv_safe(snapshot_query.query.query_text) ]
            else
              snapshot_query.snapshot_docs.each do |snapshot_doc|
                rating = Rating.find_by(query_id: snapshot_query.query.id, doc_id: snapshot_doc.doc_id)
                @csv_array << [ make_csv_safe(snapshot_query.query.query_text), snapshot_doc.doc_id,
                                rating&.rating ]
              end
            end
          end
        end

        def append_case_csv_rows
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

        # https://stackoverflow.com/questions/5608918/pad-an-array-to-be-a-certain-size
        # rubocop:disable-next Naming/MethodParameterName
        def padright! a, n, x
          a.fill(x, a.length...n)
        end
      end
    end
  end
end
