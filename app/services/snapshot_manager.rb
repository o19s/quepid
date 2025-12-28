# frozen_string_literal: true

# rubocop:disable Metrics/ClassLength
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
  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/MethodLength
  def add_docs docs, queries
    queries_to_import = []

    keys = docs.nil? ? [] : docs.keys

    # Start by adding queries to snapshot.
    # First, setup all queries to be added in an array.
    # block_with_progress_bar(keys.length) do |i|
    keys.length.times.each do |i|
      query_id = keys[i]

      snapshot_query = @snapshot.snapshot_queries.where(query_id: query_id).first_or_initialize

      # Quepid front end can send -- as no score.
      queries[query_id]['score'] = nil if '--' == queries[query_id]['score']
      snapshot_query.score = queries[query_id][:score]
      snapshot_query.all_rated = queries[query_id][:all_rated]
      snapshot_query.number_of_results = queries[query_id][:number_of_results]

      queries_to_import << snapshot_query
    end

    # Second, mass insert queries.
    if queries_to_import.any?
      SnapshotQuery.insert_all(
        queries_to_import.map do |query|
          query.attributes.except('id')
        end
      )
    end
    # End of queries import.

    # Then import docs for the queries that were just created.
    # This method is shared with the `import_queries` method
    # which does the same thing with a slightly different set of data.
    import_docs keys, docs

    self
  end
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/MethodLength

  #
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
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/AbcSize
  def import_queries queries
    queries_to_import = []
    keys              = queries.keys

    # Fetch all queries for the snapshot's case where the query text
    # matches the keys in the hash supplied in the params.
    queries_params = {
      query_text: keys,
      case_id:    @snapshot.case_id,
    }
    indexed_queries = Query.where(queries_params)
      .all
      .index_by(&:query_text)

    # Start by adding queries to snapshot.
    # First, setup all queries to be added in an array.
    # print_step 'Importing queries'
    # block_with_progress_bar(keys.length) do |i|
    keys.length.times.each do |i|
      query_text  = keys[i]
      query       = fetch_or_create_query indexed_queries, query_text

      snapshot_query = @snapshot.snapshot_queries.where(query_id: query.id).first_or_initialize

      queries[query.id] = queries.delete(keys[i])

      queries_to_import << snapshot_query
    end

    # Second, mass insert queries.
    if queries_to_import.any?
      SnapshotQuery.insert_all(
        queries_to_import.map do |query|
          query.attributes.except('id')
        end
      )
    end
    # End of queries import.

    # Updates keys after we switched them out from the text to the id
    keys = queries.keys
    data = {}
    queries.each { |key, q| data[key] = q[:docs] || q['docs'] }

    # Then import docs for the queries that were just created.
    import_docs keys, data

    self
  end
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/AbcSize

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

  # rubocop:disable Metrics/MethodLength
  def setup_docs_for_query query, docs
    results = []

    return results if docs.blank?
    return results if query.blank?

    docs = normalize_docs_array docs
    docs = docs.sort { |d1, d2| d1[:position].to_i <=> d2[:position].to_i }

    docs.each_with_index do |doc, index|
      doc_params = {
        doc_id:     doc[:id],
        explain:    doc[:explain],
        position:   doc[:position] || (index + 1),
        rated_only: doc[:rated_only] || false,
        fields:     doc[:fields].presence&.to_json,
      }

      results << query.snapshot_docs.build(doc_params)
    end

    results
  end
  # rubocop:enable Metrics/MethodLength

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

      each.presence&.symbolize_keys!
    end.compact

    result
  end

  # rubocop:disable Metrics/MethodLength
  def import_docs keys, data
    docs_to_import = []

    indexed_snap_queries = @snapshot.snapshot_queries
      .where(query_id: keys)
      .all
      .index_by { |q| q.query_id.to_s }

    # print_step 'Importing docs'
    # block_with_progress_bar(keys.length) do |i|
    keys.length.times.each do |i|
      query_id  = keys[i]
      docs      = data[keys[i]]

      snapshot_query  = indexed_snap_queries[query_id.to_s]
      query_docs      = setup_docs_for_query snapshot_query, docs

      docs_to_import += query_docs
    end

    if docs_to_import.any?
      SnapshotDoc.insert_all(
        docs_to_import.map do |doc|
          doc.attributes.except('id')
        end
      )
    end

    self
  end
  # rubocop:enable Metrics/MethodLength

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
# rubocop:enable Metrics/ClassLength
