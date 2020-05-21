# frozen_string_literal: true

if @default.communal?
  json.default @default, partial: 'api/v1/scorers/communal_scorer', as: :scorer
elsif
  json.default @default, partial: 'api/v1/scorers/scorer', as: :scorer
end

json.user_scorers @user_scorers do |scorer|
  json.partial! "api/v1/scorers/scorer", scorer: scorer
end

json.default_scorers @default_scorers do |scorer|
  json.partial! "api/v1/scorers/scorer", scorer: scorer
end
