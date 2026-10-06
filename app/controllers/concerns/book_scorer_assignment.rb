# frozen_string_literal: true

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
