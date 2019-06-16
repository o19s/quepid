# frozen_string_literal: true

json.scores do
  json.array! @scores, partial: 'api/v1/case_scores/score', as: :score
end
