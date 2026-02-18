# frozen_string_literal: true

# Renders the "Frog Pond Report" trigger and modal for the case/try workspace.
# Shows rating coverage analysis: how many query/document pairs are missing ratings.
# Replaces the Angular frog_report directive. The D3 bar chart replaces the Vega spec.
#
# Stats are computed server-side from Rating records. The `depth` parameter (try's
# number_of_rows) defines the expected rating depth per query. For each query,
# missing = max(depth - ratings_count, 0).
#
# @see docs/view_component_conventions.md
class FrogReportComponent < ApplicationComponent
  # @param case_id [Integer]
  # @param case_name [String]
  # @param queries_count [Integer] total queries in the case
  # @param book_id [Integer, nil] linked book id, if any
  # @param book_name [String, nil] linked book name, if any
  # @param depth [Integer] try's number_of_rows (k)
  # @param all_rated [Boolean] from last score's all_rated flag
  # @param rating_stats [Array<Hash>] each { query_id:, ratings_count: }
  def initialize(case_id:, case_name:, queries_count:, book_id:, book_name:, depth:, all_rated:, rating_stats:)
    @case_id = case_id
    @case_name = case_name
    @queries_count = queries_count
    @book_id = book_id
    @book_name = book_name
    @depth = depth
    @all_rated = all_rated
    @rating_stats = rating_stats
  end

  def total_ratings_needed
    @queries_count * @depth
  end

  def total_ratings
    @rating_stats.sum { |s| s[:ratings_count] }
  end

  def missing_ratings
    @rating_stats.sum { |s| [@depth - s[:ratings_count], 0].max }
  end

  def missing_rate
    return 0.0 if total_ratings_needed.zero?

    (missing_ratings.to_f / total_ratings_needed * 100).round(1)
  end

  def queries_with_results_count
    @rating_stats.count { |s| s[:ratings_count] > 0 }
  end

  def queries_without_results_count
    @rating_stats.count { |s| s[:ratings_count].zero? }
  end

  def book?
    @book_id.present?
  end

  # JSON array for D3 chart: distribution of queries grouped by missing-rating count.
  # Same logic as Angular numberOfMissingRatingsByMissingCount.
  def chart_data_json
    distribution = Hash.new(0)
    @rating_stats.each do |s|
      missing = [@depth - s[:ratings_count], 0].max
      distribution[missing] += 1
    end

    rows = distribution.sort_by(&:first).map do |missing_count, query_count|
      label = if missing_count.zero?
                "Fully Rated"
              elsif missing_count == @depth
                "No Ratings"
              else
                "Missing #{missing_count}"
              end
      { category: label, amount: query_count }
    end

    rows.to_json
  end
end
