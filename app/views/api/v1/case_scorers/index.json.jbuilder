# frozen_string_literal: true

# I think this isn't required anymore.
if @default.communal?
  json.default @default, partial: 'api/v1/scorers/communal_scorer', as: :scorer
else
  json.default @default, partial: 'api/v1/scorers/scorer', as: :scorer
end

json.user_scorers @user_scorers do |scorer|
  json.partial! 'api/v1/scorers/scorer', scorer: scorer
end

json.communal_scorers @communal_scorers do |scorer|
  json.partial! 'api/v1/scorers/communal_scorer', scorer: scorer
end
