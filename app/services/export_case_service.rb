# frozen_string_literal: true

require 'csv'

# Generates case export files (CSV, JSON) for use by API controller and ExportCaseJob.
#
# @see Api::V1::Export::CasesController
# @see ExportCaseJob
class ExportCaseService
  def self.general_csv acase
    last_score = acase.last_score
    last_score = last_score.first if last_score.is_a?(ActiveRecord::Relation)
    headers = [ 'Team Name', 'Case Name', 'Case ID', 'Query Text', 'Score', 'Date Last Scored', 'Count', 'Information Need', 'Notes', 'Options' ]
    rows = []

    if last_score.respond_to?(:queries) && last_score.queries.present?
      queries_by_id = acase.queries.index_by(&:id)
      team_names = acase.teams.pluck(:name).join(', ')
      updated_at = last_score.updated_at&.strftime('%Y-%m-%d %H:%M:%S')

      last_score.queries.each do |query_id_str, data|
        data = data.with_indifferent_access
        query = queries_by_id[query_id_str.to_i]
        next unless query

        options = query.options.presence
        options = nil if options.is_a?(Hash) && options.empty?
        options_str = options.is_a?(Hash) || options.is_a?(Array) ? JSON.generate(options) : options.to_s

        rows << [
          team_names,
          acase.case_name,
          acase.id,
          query.query_text,
          data[:score],
          updated_at,
          data[:numFound] || data['numFound'],
          query.information_need,
          query.notes,
          options_str
        ]
      end
    end

    [ rows, headers ]
  end

  def self.detailed_csv acase
    last_score = acase.last_score
    last_score = last_score.first if last_score.is_a?(ActiveRecord::Relation)
    team_names = acase.teams.pluck(:name).join(', ')
    case_id = (last_score.respond_to?(:case_id) && last_score&.case_id) || acase.id
    try = acase.tries.first
    extra_fields = try&.field_spec.present? ? field_spec_extra_columns(try.field_spec) : []
    headers = [ 'Team Name', 'Case Name', 'Case ID', 'Query Text', 'Doc ID', 'Doc Position', 'Title', 'Rating' ] + extra_fields
    rows = []

    acase.queries.includes(:ratings).find_each do |query|
      ratings = query.ratings.fully_rated.order(:id)
      if ratings.empty?
        row = [ team_names, acase.case_name, case_id, query.query_text, '', '', '', '' ]
        extra_fields.each { row << '' }
        rows << row
      else
        ratings.each_with_index do |rating, idx|
          row = [ team_names, acase.case_name, case_id, query.query_text, rating.doc_id, idx + 1, '', rating.rating ]
          extra_fields.each { row << '' }
          rows << row
        end
      end
    end

    [ rows, headers ]
  end

  def self.snapshot_csv acase, snapshot
    field_keys = snapshot_field_keys(snapshot)
    headers = [ 'Snapshot Name', 'Snapshot Time', 'Case ID', 'Query Text', 'Doc ID', 'Doc Position' ] + field_keys
    rows = []

    snapshot.snapshot_queries.includes(:query, :snapshot_docs).find_each do |sq|
      query_text = sq.query&.query_text || ''
      sq.snapshot_docs.order(:position).each_with_index do |doc, idx|
        fields = doc.fields.present? ? JSON.parse(doc.fields) : {}
        row = [
          snapshot.name,
          snapshot.created_at&.strftime('%Y-%m-%d %H:%M:%S'),
          acase.id,
          query_text,
          doc.doc_id,
          doc.position || (idx + 1)
        ]
        field_keys.each { |k| row << (fields[k] || fields[k.to_s]) }
        rows << row
      end
    end

    [ rows, headers ]
  end

  def self.csv_string rows, headers
    CSV.generate do |csv|
      csv << headers
      rows.each do |row|
        csv << row.map { |cell| csv_cell(cell) }
      end
    end
  end

  def self.csv_cell val
    return '' if val.nil?
    return JSON.generate(val) if val.is_a?(Hash) || val.is_a?(Array)

    s = val.to_s.strip
    s = " #{s}" if s.start_with?('=', '@', '+', '-')
    s
  end

  def self.field_spec_extra_columns field_spec
    specs = field_spec.to_s.split(/[\s,]+/)
    specs.reject { |f| 'id' == f || '_id' == f || f.to_s.downcase.include?('title') }.uniq
  end

  def self.snapshot_field_keys snapshot
    keys = []
    snapshot.snapshot_queries.includes(:snapshot_docs).find_each do |sq|
      sq.snapshot_docs.each do |doc|
        next if doc.fields.blank?

        parsed = JSON.parse(doc.fields)
        keys = (keys + parsed.keys).uniq
      rescue JSON::ParserError
        next
      end
    end
    keys
  end
end
