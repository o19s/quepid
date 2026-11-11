# frozen_string_literal: true

module TeamAssignable
  extend ActiveSupport::Concern

  private

  # Checkboxes suck: only touch teams the current user can actually see, so this can't
  # accidentally unshare the record from a team the submitting user isn't a member of
  # (BooksController#update's team_ids handling doesn't scope to current_user.teams the same way
  # -- don't copy that pattern). Loads current_user.teams once and derives both the membership
  # check and the selected teams from it, rather than querying it twice. Safe to call on a record
  # whose teams start empty (create) or already set (update).
  def apply_team_ids record, team_ids
    user_teams = current_user.teams.to_a
    selected_ids = Array(team_ids).compact_blank.map(&:to_i)

    kept_teams = record.teams.reject { |t| user_teams.any? { |ut| ut.id == t.id } }
    selected_teams = user_teams.select { |t| selected_ids.include?(t.id) }
    record.teams.replace(kept_teams | selected_teams)
  end
end
