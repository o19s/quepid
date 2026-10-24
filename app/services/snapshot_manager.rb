# frozen_string_literal: true

class SnapshotManager
  attr_reader :logger, :options

  def initialize snapshot, opts = {}
    default_options = {
      format:        :csv,
      logger:        Rails.logger,
      show_progress: false,
    }

    @options  = default_options.merge(opts.deep_symbolize_keys)
    @logger   = @options[:logger]
    @snapshot = snapshot
  end

  def show_progress?
    options[:show_progress]
  end

  #
  # Adds docs to a snapshot, assuming snapshot is being created from the
  # app and thus all the queries already exist for the case
  # (so no need to create them).
  #
  # @param  data, hash
  # @return self
  #
  # Example:
  #
  # manager = SnapshotManager.new snapshot
  # data    = {
  #   123 => [
  #     { id: "doc1", explain: "1" },
  #     { id: "doc2", explain: "2" },
  #   ],
  #   456 => [
  #     { id: "doc3", explain: "3" },
  #     { id: "doc4", explain: "4" },
  #   ]
  # }
  # manager.add_docs data
  def add_docs docs, queries
    docs = docs.to_unsafe_h if docs.is_a?(ActionController::Parameters)
    data = (docs || {}).to_h do |query_id, query_docs|
      result = queries[query_id]
      result = result.to_unsafe_h if result.is_a?(ActionController::Parameters)
      [ query_id, result.to_h.merge(docs: query_docs) ]
    end
    write_queries data

    self
  end

  # Imports queries and docs to a snapshot.
  # If the query does not already exists, it adds it to the case first,
  # then it adds it to the snapshot.
  #
  # @param  queries, hash
  # @return self
  #
  # Example:
  #
  # manager = SnapshotManager.new snapshot
  # data = {
  #   "dog" => {
  #     docs: [
  #       { id: "doc1", explain: "1", position: 1 },
  #       { id: "doc2", explain: "2", position: 2 },
  #     ]
  #   },
  #   "cat" => {
  #     docs: [
  #       { id: "doc3", explain: "3", position: 2 },
  #       { id: "doc4", explain: "4", position: 1 },
  #     ]
  #   }
  # }
  # manager.import_queries data
  #
  def import_queries queries
    indexed_queries = Query.where(query_text: queries.keys, case_id: @snapshot.case_id).index_by(&:query_text)

    # Import preparation resolves text to case queries; existing-query writers
    # supply ids directly. Keep the import's id-keyed result for callers.
    queries.keys.each do |query_text|
      query = fetch_or_create_query indexed_queries, query_text
      queries[query.id] = queries.delete(query_text)
    end

    write_queries queries

    self
  end

  # Each write appends a fresh row for each query, even when this snapshot
  # already contains that query. Return the exact rows created, keyed by query
  # id, so callers never need to select among duplicates.
  def write_queries data
    data = data.to_unsafe_h if data.is_a?(ActionController::Parameters)
    SnapshotQuery.transaction do
      written_queries = {}
      docs_to_import = []
      data.each do |query_id, result|
        result = normalize_query_result(result)
        attributes = result.slice(:score, :all_rated, :number_of_results, :response_status, :error)
        attributes[:score] = nil if '--' == attributes[:score]
        query = @snapshot.snapshot_queries.create!(attributes.merge(query_id: query_id))
        written_queries[query_id] = query
        docs_to_import.concat(setup_docs_for_query(query, result[:docs]))
      end
      SnapshotDoc.insert_all(docs_to_import.map { |doc| doc.attributes.except('id') }) if docs_to_import.any?

      # Discard the unsaved association objects used to prepare the bulk insert.
      written_queries.each_value { |query| query.snapshot_docs.reset }
      written_queries
    end
  end

  def normalize_query_result result
    result = result.to_unsafe_h if result.is_a?(ActionController::Parameters)
    result.to_h.symbolize_keys
  end

  def csv_to_queries_hash docs
    # print_step 'Transforming csv into a queries hash'

    query_docs = {}
    # block_with_progress_bar(docs.length) do |i|
    docs.length.times.each do |i|
      row = extract_doc_info docs[i]
      query_docs[row[:query_text]] ||= { docs: [] }
      query_docs[row[:query_text]][:docs] << row
    end

    query_docs
  end

  def setup_docs_for_query query, docs
    results = []

    return results if docs.blank?
    return results if query.blank?

    docs = normalize_docs_array docs
    docs = docs.sort { |d1, d2| d1[:position].to_i <=> d2[:position].to_i }

    docs.each_with_index do |doc, index|
      doc_params = {
        doc_id:     doc[:id],
        explain:    doc[:explain].is_a?(Hash) ? doc[:explain].to_json : doc[:explain],
        position:   doc[:position] || (index + 1),
        rated_only: doc[:rated_only] || false,
        fields:     doc[:fields].presence&.to_json,
      }

      results << query.snapshot_docs.build(doc_params)
    end

    results
  end

  def extract_doc_info row
    case @options[:format]
    when :csv
      {
        query_text: row[0],
        id:         row[1],
        position:   row[2],
      }
    when :hash
      row.deep_symbolize_keys
    else
      row
    end
  end

  def normalize_docs_array docs
    return [] if docs.blank?

    result = docs.map do |each|
      each = each.to_unsafe_h if each.is_a?(ActionController::Parameters)
      each = each.to_hash     if each.is_a?(ActiveSupport::HashWithIndifferentAccess)

      each.presence&.symbolize_keys
    end.compact

    result
  end

  def fetch_or_create_query indexed_queries, query_text
    if indexed_queries[query_text].present?
      indexed_queries[query_text]
    else
      query_params = {
        query_text: query_text,
        case_id:    @snapshot.case_id,
      }
      Query.create(query_params)
    end
  end
end
