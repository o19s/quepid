# frozen_string_literal: true

require 'progress_indicator'

# rubocop:disable Metrics/ClassLength
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

  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/PerceivedComplexity
  # rubocop:disable Metrics/CyclomaticComplexity
  def import
    if @options[:clear_existing]
      print_step 'Clearing all ratings'
      ratings = []
      @acase.queries.each do |query|
        query.ratings.each do |rating|
          ratings << rating.id
        end
      end
      Rating.delete ratings
    end

    if @options[:drop_header]
      @ratings = @ratings.drop(1) # get rid of header row
    end
    #
    # 2 ways to import ratings:
    #   i. The naive way:
    #     a. Loop through each row
    #     b. Create or fetch the query based on the query text (cache the query)
    #     c. Create or update the rating
    #   ii. The less naive way, which we are using:
    #     a. Map from the rows all the unique queries
    #     b. Fetch all the existing queries
    #     c. Determine which queries do not already exist
    #     d. Create remaining queries in bulk
    #     e. Updating existing ratings if needed
    #     f. Create remaining ratings in mass
    #

    # a. Map from the rows all the unique queries
    normalized_rows = @ratings.map { |row| extract_rating_info row }
    query_texts     = normalized_rows.pluck(:query_text)
    unique_queries  = query_texts.uniq

    # b. Fetch all the existing queries
    queries_params = {
      query_text: unique_queries,
      case_id:    @acase.id,
    }
    indexed_queries = Query.where(queries_params)
      .all
      .index_by(&:query_text)

    # c. Determine which queries do not already exist
    existing_queries = indexed_queries.keys
    non_existing_queries = unique_queries - existing_queries

    if non_existing_queries.empty?
      @queries = indexed_queries
    else
      # d. Create remaining queries in bulk
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

      # Refetch the queries now that we've created new ones
      queries_params = {
        query_text: unique_queries,
        case_id:    @acase.id,
      }
      @queries = Query.where(queries_params)
        .all
        .index_by(&:query_text)
    end

    # e. Create or update ratings
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

    return unless @options[:clear_existing]

    print_step 'Clearing unused queries'

    @acase.queries.each do |query|
      query.destroy if @queries[query.query_text].blank?
    end
  end
  # rubocop:enable Metrics/PerceivedComplexity
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/CyclomaticComplexity

  private

  # rubocop:disable Metrics/MethodLength
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
  # rubocop:enable Metrics/MethodLength
end
# rubocop:enable Metrics/ClassLength
