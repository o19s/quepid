# frozen_string_literal: true

# Renders the annotations panel: create form + list of existing annotations.
# Replaces the Angular annotations component.
#
# @see docs/view_component_conventions.md
class AnnotationsComponent < ApplicationComponent
  # @param case_id [Integer] Case id for API calls
  # @param annotations [ActiveRecord::Relation] annotations collection (with score, user included)
  # @param last_score [Score, nil] Most recent case score for creating new annotations
  def initialize case_id:, annotations:, last_score: nil
    @case_id     = case_id
    @annotations = annotations
    @last_score  = last_score
  end

  def score?
    @last_score.present?
  end

  def last_score_json
    return '{}' unless score?

    {
      all_rated: @last_score.all_rated,
      score:     @last_score.score,
      try_id:    @last_score.try_id,
      queries:   @last_score.queries,
    }.to_json
  end
end
