# frozen_string_literal: true

json.scorers do
  json.array! @scorers, partial: 'api/v1/scorers/scorer', as: :scorer
end
