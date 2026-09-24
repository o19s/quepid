# frozen_string_literal: true

# Copies a scorer's scale onto a book. The scorer is scoped to the current
# user (rather than looked up unscoped) so a book can't pick up the scale of
# a scorer nobody has actually shared with whoever is creating/editing it.
# Shared by BooksController and Api::V1::BooksController so both entry points
# for creating/updating a book actually apply a chosen scorer_id, instead of
# just accepting it as a param and silently doing nothing with it.
module BookScorerAssignment
  extend ActiveSupport::Concern

  private

  def apply_scorer_to_book book, scorer_id
    scorer = current_user.scorers_involved_with.find_by(id: scorer_id)
    return unless scorer

    book.scale = scorer.scale
    book.scale_with_labels = scorer.scale_with_labels
  end
end
