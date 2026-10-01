# frozen_string_literal: true

# Scoped to the current user's scorers, not looked up unscoped, so a book
# can't pick up the scale of a scorer nobody has actually shared with whoever
# is creating or editing it. Shared by BooksController and
# Api::V1::BooksController so both entry points handle scorer_id the same way.
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
