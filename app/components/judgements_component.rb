# frozen_string_literal: true

# Renders the "Judgements" trigger and modal for linking a case to a Book of Judgements,
# selecting/changing book, and refreshing ratings from a book. Works with the judgements
# Stimulus controller. Replaces the Angular judgements component.
#
# API: GET api/teams/:id/books, PUT api/cases/:id { book_id }, PUT api/books/:id/cases/:case_id/refresh
# "Populate Book" (updateQueryDocPairs) deferred until query list with docs is migrated.
#
# @see docs/view_component_conventions.md
class JudgementsComponent < ApplicationComponent
  # @param case_id [Integer] Case id
  # @param case_name [String] Display name
  # @param book_id [Integer, nil] Current book id (if any)
  # @param book_name [String, nil] Current book name (if any)
  # @param queries_count [Integer] Number of queries (for background refresh threshold)
  # @param scorer_id [Integer, nil] Case scorer id (for create-book link)
  # @param teams [Array<Hash>, ActiveRecord::Relation] Teams the case is shared with (id, name)
  # @param button_label [String, nil] Optional label for Angular parity (e.g. "Filter Relevancy")
  def initialize case_id:, case_name:, book_id: nil, book_name: nil, queries_count: 0, scorer_id: nil, teams: [], button_label: nil
    @case_id       = case_id
    @case_name     = case_name
    @book_id       = book_id
    @book_name     = book_name
    @queries_count = queries_count
    @scorer_id     = scorer_id
    @teams         = teams.respond_to?(:to_ary) ? teams.to_ary : teams.to_a
    @button_label  = button_label
  end

  def teams_for_data
    @teams.map { |t| t.respond_to?(:id) ? { id: t.id, name: t.name } : { id: t[:id] || t['id'], name: t[:name] || t['name'] } }.to_json
  end

  # URL for creating a new book, with query params so BooksController#new can pre-fill
  # scorer, teams, and link-the-case. BooksController#new accepts origin_case_id,
  # scorer_id, and team_ids (or team_ids[]) as query params.
  def create_book_url
    team_ids = @teams.map { |t| t.respond_to?(:id) ? t.id : (t[:id] || t['id']) }
    view_context.new_book_path(origin_case_id: @case_id, scorer_id: @scorer_id, team_ids: team_ids)
  end
end
