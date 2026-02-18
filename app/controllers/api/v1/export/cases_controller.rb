# frozen_string_literal: true

require 'csv'

module Api
  module V1
    module Export
      class CasesController < Api::ApiController
        before_action :set_case
        before_action :check_case
        before_action :set_snapshot, only: [ :snapshot ]

        def show
          respond_with @case
        end

        # GET api/export/cases/:case_id/general.csv
        # General CSV: Team Name, Case Name, Case ID, Query Text, Score, Date Last Scored, Count, Information Need, Notes, Options
        def general
          last_score = @case.last_score
          last_score = last_score.first if last_score.is_a?(ActiveRecord::Relation)
          unless last_score.respond_to?(:queries) && last_score.queries.present?
            return send_csv([], general_header_row, "general")
          end

          rows = []
          queries_by_id = @case.queries.index_by(&:id)
          team_names = @case.teams.pluck(:name).join(', ')
          updated_at = last_score.updated_at&.strftime('%Y-%m-%d %H:%M:%S')

          last_score.queries.each do |query_id_str, data|
            data = data.with_indifferent_access
            query = queries_by_id[query_id_str.to_i]
            next unless query

            options = query.options.presence
            options = nil if options.is_a?(Hash) && options.empty?
            options_str = (options.is_a?(Hash) || options.is_a?(Array)) ? JSON.generate(options) : options.to_s

            rows << [
              team_names,
              @case.case_name,
              @case.id,
              query.query_text,
              data[:score],
              updated_at,
              data[:numFound] || data['numFound'],
              query.information_need,
              query.notes,
              options_str
            ]
          end

          send_csv(rows, general_header_row, "general")
        end

        # GET api/export/cases/:case_id/detailed.csv
        # Detailed CSV: Team Name, Case Name, Case ID, Query Text, Doc ID, Position, Title, Rating, [Field1...FieldN from try field_spec]
        def detailed
          last_score = @case.last_score
          last_score = last_score.first if last_score.is_a?(ActiveRecord::Relation)
          team_names = @case.teams.pluck(:name).join(', ')
          case_id = last_score&.case_id || @case.id
          try = @case.tries.first
          extra_fields = try&.field_spec.present? ? field_spec_extra_columns(try.field_spec) : []

          csv_headers = detailed_header_row(extra_fields)
          rows = []

          @case.queries.includes(:ratings).each do |query|
            ratings = query.ratings.fully_rated.order(:id)
            if ratings.empty?
              row = [ team_names, @case.case_name, case_id, query.query_text, '', '', '', '' ]
              extra_fields.each { row << '' }
              rows << row
            else
              ratings.each_with_index do |rating, idx|
                row = [ team_names, @case.case_name, case_id, query.query_text, rating.doc_id, idx + 1, '', rating.rating ]
                extra_fields.each { row << '' }
                rows << row
              end
            end
          end

          send_csv(rows, csv_headers, "detailed")
        end

        # GET api/export/cases/:case_id/snapshot.csv?snapshot_id=:id
        # Snapshot CSV: Snapshot Name, Snapshot Time, Case ID, Query Text, Doc ID, Doc Position, [Field keys from snapshot_docs]
        def snapshot
          unless @snapshot
            return render json: { error: 'Snapshot not found' }, status: :not_found
          end

          field_keys = snapshot_field_keys
          csv_headers = snapshot_header_row(field_keys)
          rows = []

          @snapshot.snapshot_queries.includes(:query, :snapshot_docs).each do |sq|
            query_text = sq.query&.query_text || ''
            sq.snapshot_docs.order(:position).each_with_index do |doc, idx|
              fields = doc.fields.present? ? JSON.parse(doc.fields) : {}
              row = [
                @snapshot.name,
                @snapshot.created_at&.strftime('%Y-%m-%d %H:%M:%S'),
                @case.id,
                query_text,
                doc.doc_id,
                (doc.position || idx + 1)
              ]
              field_keys.each { |k| row << (fields[k] || fields[k.to_s]) }
              rows << row
            end
          end

          send_csv(rows, csv_headers, "snapshot")
        end

        private

        def set_snapshot
          @snapshot = @case.snapshots.find_by(id: params[:snapshot_id])
        end

        def general_header_row
          %w[Team\ Name Case\ Name Case\ ID Query\ Text Score Date\ Last\ Scored Count Information\ Need Notes Options]
        end

        def detailed_header_row(extra_fields)
          %w[Team\ Name Case\ Name Case\ ID Query\ Text Doc\ ID Doc\ Position Title Rating] + extra_fields
        end

        def field_spec_extra_columns(field_spec)
          specs = field_spec.to_s.split(/[\s,]+/)
          specs.reject { |f| f == 'id' || f == '_id' || f.to_s.downcase.include?('title') }.uniq
        end

        def snapshot_header_row(field_keys)
          %w[Snapshot\ Name Snapshot\ Time Case\ ID Query\ Text Doc\ ID Doc\ Position] + field_keys
        end

        def snapshot_field_keys
          keys = []
          @snapshot.snapshot_queries.includes(:snapshot_docs).each do |sq|
            sq.snapshot_docs.each do |doc|
              next unless doc.fields.present?
              parsed = JSON.parse(doc.fields)
              keys = (keys + parsed.keys).uniq
            rescue JSON::ParserError
              next
            end
          end
          keys
        end

        def send_csv(rows, csv_header_row, suffix)
          safe_name = @case.case_name.to_s.gsub(/[\s:]+/, '_')
          response.headers['Content-Disposition'] = "attachment; filename=\"#{safe_name}_#{suffix}.csv\""
          response.headers['Content-Type'] = 'text/csv'

          csv_string = CSV.generate do |csv|
            csv << csv_header_row
            rows.each do |row|
              csv << row.map { |cell| csv_cell(cell) }
            end
          end

          render plain: csv_string
        end

        def csv_cell(val)
          return '' if val.nil?
          if val.is_a?(Hash) || val.is_a?(Array)
            return JSON.generate(val)
          end
          s = val.to_s.strip
          s = " #{s}" if s.start_with?('=', '@', '+', '-')
          s
        end
      end
    end
  end
end
