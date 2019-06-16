# frozen_string_literal: true

if @default.is_a?(Scorer)
  json.default @default, partial: 'api/v1/scorers/scorer', as: :scorer
elsif @default.is_a?(DefaultScorer)
  json.default @default, partial: 'api/v1/default_scorers/scorer', as: :scorer
end

json.user_scorers @user_scorers do |scorer|
  json.partial! "api/v1/#{scorer.class.table_name}/scorer", scorer: scorer
end

json.default_scorers @default_scorers do |scorer|
  json.partial! "api/v1/#{scorer.class.table_name}/scorer", scorer: scorer
end

json.community_scorers @community_scorers do |scorer|
  json.partial! "api/v1/#{scorer.class.table_name}/scorer", scorer: scorer
end
