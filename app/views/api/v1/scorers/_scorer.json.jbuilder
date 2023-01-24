# frozen_string_literal: true

teams = scorer.teams.find_all { |t| current_user.teams.all.include?(t) }

json.scorerId             scorer.id
json.communal             scorer.communal
json.code                 scorer.code
json.name                 scorer.name
json.scale                scorer.scale
json.owner_id             scorer.owner_id
json.owned                scorer.owner_id == current_user.id
json.owner_name           scorer.owner.name unless scorer.owner.nil?
json.manual_max_score       scorer.manual_max_score
json.manual_max_score_value scorer.manual_max_score_value
json.show_scale_labels      scorer.show_scale_labels
json.scale_with_labels      scorer.scale_with_labels
json.teams teams

json.teams teams do |team|
  json.id         team.id
  json.name       team.name
  json.owner_id   team.owner_id
end
