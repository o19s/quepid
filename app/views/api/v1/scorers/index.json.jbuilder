# frozen_string_literal: true

json.user_scorers do
  json.array! @user_scorers, partial: 'scorer', as: :scorer
end

json.default_scorers do
  json.array! @default_scorers, partial: 'api/v1/default_scorers/scorer', as: :scorer
end
