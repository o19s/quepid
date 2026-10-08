# frozen_string_literal: true

require 'progress_indicator'

class RatingsImporter
  include ProgressIndicator

  attr_reader :logger, :options

  def initialize acase, ratings, opts = {}
    default_options = {
      clear_existing: false,
      force:          false,
      format:         :csv,
      logger:         Rails.logger,
      show_progress:  false,
      drop_header:    false,
      user:           acase.owner,
    }

    @options  = default_options.merge(opts.deep_symbolize_keys)

    @acase    = acase
    @ratings  = ratings
    @logger   = @options[:logger]

    @queries  = {}
  end

  def show_progress?
    options[:show_progress]
  end

  def import
    clear_existing_ratings if @options[:clear_existing]
    @ratings = @ratings.drop(1) if @options[:drop_header] # get rid of header row

    normalized_rows = @ratings.map { |row| extract_rating_info row }
    prepare_queries(normalized_rows.pluck(:query_text).uniq)
    ratings_to_update, ratings_to_import = build_rating_changes(normalized_rows)
    persist_rating_changes(ratings_to_update, ratings_to_import)
    sync_imported_ratings(ratings_to_update, ratings_to_import)

    return unless @options[:clear_existing]

    clear_unused_queries
  end

  private

  def clear_existing_ratings
    print_step 'Clearing all ratings'
    ratings = []
    @acase.queries.each do |query|
      query.ratings.each do |rating|
        ratings << rating.id
      end
    end
    Rating.delete ratings
  end

  def prepare_queries unique_queries
    queries_params = {
      query_text: unique_queries,
      case_id:    @acase.id,
    }
    indexed_queries = Query.where(queries_params)
      .all
      .index_by(&:query_text)

    # Determine which queries do not already exist
    existing_queries = indexed_queries.keys
    non_existing_queries = unique_queries - existing_queries

    if non_existing_queries.empty?
      @queries = indexed_queries
    else
      insert_queries(non_existing_queries)
      # Refetch the queries now that we've created new ones
      @queries = Query.where(queries_params).all.index_by(&:query_text)
    end
  end

  def insert_queries non_existing_queries
    queries_to_import = []
    print_step 'Importing queries'
    block_with_progress_bar(non_existing_queries.length) do |i|
      query_text  = non_existing_queries[i]
      query       = Query.new query_text: query_text, case_id: @acase.id

      queries_to_import << query
    end

    # Mass insert queries using Rails' insert_all
    if queries_to_import.any?
      Query.insert_all(
        queries_to_import.map do |query|
          query.attributes.except('id').merge(
            'created_at' => Time.zone.now,
            'updated_at' => Time.zone.now
          )
        end
      )
    end
  end

  def build_rating_changes normalized_rows
    ratings_to_import = []
    ratings_to_update = []
    print_step 'Importing ratings'

    block_with_progress_bar(normalized_rows.length) do |i|
      row         = normalized_rows[i]
      query_text  = row[:query_text]
      doc_id      = row[:doc_id]
      rating      = row[:rating]

      if doc_id.present? && rating.present? # queries are always created.
        print_step "Importing rating: #{rating} for query: #{query_text} and doc: #{doc_id}"

        query   = @queries[query_text]
        exists  = query.ratings.where(doc_id: doc_id).first

        if exists.present? && @options[:force]
          exists.rating = rating
          ratings_to_update << exists
        elsif exists.blank?
          ratings_to_import << query.ratings.build(doc_id: doc_id, rating: rating)
        end
      end
    end

    [ ratings_to_update, ratings_to_import ]
  end

  def persist_rating_changes ratings_to_update, ratings_to_import
    # Mass update ratings
    ActiveRecord::Base.transaction do
      ratings_to_update.each(&:save)
    end

    # Mass insert ratings using Rails' insert_all
    if ratings_to_import.any?
      Rating.insert_all(
        ratings_to_import.map do |rating|
          rating.attributes.except('id').merge(
            'created_at' => Time.zone.now,
            'updated_at' => Time.zone.now
          )
        end
      )
    end
  end

  def sync_imported_ratings ratings_to_update, ratings_to_import
    imported = (ratings_to_update + ratings_to_import).filter_map do |rating|
      rating.query.ratings.find_by(doc_id: rating.doc_id)
    end
    JudgementSync.from_ratings(@options[:user], imported)
  end

  def clear_unused_queries
    print_step 'Clearing unused queries'

    @acase.queries.each do |query|
      query.destroy if @queries[query.query_text].blank?
    end
  end

  def extract_rating_info row
    case @options[:format]
    when :csv
      {
        query_text: row[0].is_a?(String) ? row[0].strip : row[0],
        doc_id:     row[1].is_a?(String) ? row[1].strip : row[1],
        rating:     row[2].is_a?(String) ? row[2].strip : row[2],
      }
    when :hash
      row.deep_symbolize_keys

      row.each do |k, v|
        row[k] = v.strip if v.is_a?(String)
      end

      row
    else
      row
    end
  end
end
