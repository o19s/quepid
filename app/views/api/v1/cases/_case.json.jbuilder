# frozen_string_literal: true

shallow   ||= false
no_tries  ||= false
no_teams  ||= false
analytics ||= false

teams = acase.teams.find_all { |t| current_user.teams.all.include?(t) } unless no_teams

json.case_name        acase.case_name
json.caseNo           acase.id
json.scorerId         acase.scorer_id
json.owned            acase.owner_id == current_user.id
json.owner_name       acase.owner.name if acase.owner.present?
json.queriesCount     acase.queries.count
json.shared_with_team teams.count.positive? unless no_teams

json.teams            teams unless no_teams

json.last_try_number  acase.tries.best.try_number unless no_tries || acase.tries.blank? || acase.tries.best.blank?

json.ratings_view     @case_metadatum.ratings_view if @case_metadatum.present?

case_analytics_manager = CaseAnalyticsManager.new @case
if analytics && case_analytics_manager.can_calculate_variances?
  json.max_label = case_analytics_manager.max_label
  json.rating_variance number_with_precision(case_analytics_manager.case_ratings_variance, precision: 2)
end

unless shallow
  json.queries do
    json.array! acase.queries, partial: 'api/v1/queries/query', as: :query
  end
end

unless shallow
  json.tries do
    json.array! acase.tries, partial: 'api/v1/tries/try', as: :try
  end
end

# rubocop:disable Style/MultilineIfModifier
json.lastScore do
  json.partial! 'api/v1/case_scores/score', score: acase.last_score, shallow: shallow
end if acase.last_score.present?
# rubocop:enable Style/MultilineIfModifier

unless shallow
  json.scores acase.scores.includes(:annotation).limit(10) do |s|
    json.score      s.score
    json.updated_at s.updated_at
    json.note       s.annotation ? s.annotation.message : nil
  end
end
