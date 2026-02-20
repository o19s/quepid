# frozen_string_literal: true

# Renders the list of queries for the case/try workspace. Each row shows query text,
# query-level score, and actions: Move, Options, Explain. In the single-column layout,
# clicking a query row expands inline results via query_expand_controller.
#
# Uses slots for flexible composition:
# - +with_add_query+ renders the AddQueryComponent alongside the filter controls
# - +with_empty_state+ renders custom empty-state content when no queries exist
#
# @see docs/view_component_conventions.md
class QueryListComponent < ApplicationComponent
  renders_one :empty_state
  renders_one :add_query
  # @param case_id [Integer] Current case id
  # @param try_number [Integer, nil] Current try number (for move redirect)
  # @param queries [ActiveRecord::Relation, Array] Queries in display order (case.queries)
  # @param other_cases [ActiveRecord::Relation, Array] Cases user can move queries to (exclude current case)
  # @param scorer_scale_max [Numeric] Max scale value for QscoreQueryComponent (e.g. scorer.scale.last)
  # @param query_scores [Hash] Optional query_id => score for last run (from Score#queries)
  # @param sortable [Boolean] Whether drag-and-drop reorder is enabled (Rails.config.query_list_sortable)
  def initialize case_id:, try_number:, queries:, other_cases: [], scorer_scale_max: 100, query_scores: {}, sortable: true, scorer_scale: nil, rating_stats: nil
    @case_id           = case_id
    @try_number        = try_number
    @queries           = queries.respond_to?(:to_a) ? queries.to_a : Array(queries)
    @other_cases = other_cases.respond_to?(:to_a) ? other_cases.to_a : Array(other_cases)
    @scorer_scale_max   = scorer_scale_max
    @scorer_scale       = scorer_scale || [ 0, 1, 2, 3 ]
    @query_scores       = query_scores.is_a?(Hash) ? query_scores : {}
    @sortable           = sortable
    @rating_stats       = if rating_stats.present?
                            rating_stats.each_with_object({}) { |entry, memo| memo[entry[:query_id]] = entry[:ratings_count] }
                          else
                            {}
                          end
  end

  def unrated? query
    return false unless query.respond_to?(:id)

    count = @rating_stats[query.id]
    count.present? && count.zero?
  end

  def score_for query
    return '?' unless query.respond_to?(:id)

    s = @query_scores[query.id.to_s] || @query_scores[query.id]
    s.presence || '?'
  end

  def options_for_query query
    return nil unless query.respond_to?(:options)

    query.options
  end
end
