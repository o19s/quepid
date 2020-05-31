# frozen_string_literal: true

json.user_scorers do
  json.array! @user_scorers, partial: 'scorer', as: :scorer
end

json.communal_scorers do
  json.array! @communal_scorers, partial: 'communal_scorer', as: :scorer
end
