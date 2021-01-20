# frozen_string_literal: true

shallow   ||= false
no_tries  ||= false
no_teams  ||= false
analytics ||= false

unless no_teams
  teams = acase.teams.find_all do |o|
    current_user.teams.all.include?(o) || o.owner_id == current_user.id
  end
end

json.case_name        acase.case_name
json.caseNo           acase.id
json.scorerId         acase.scorer_id
json.owned            acase.user_id == current_user.id
json.queriesCount     acase.queries.count
json.shared_with_team teams.count.positive? unless no_teams

json.teams            teams unless no_teams

json.last_try_number acase.tries.best.try_number unless no_tries || acase.tries.blank? || acase.tries.best.blank?

json.ratings_view @case_metadatum.ratings_view if @case_metadatum.present?
if analytics && !teams.empty?
  max_label = acase.scorer.scale.last
  case_variance_values = []
  acase.queries.each do |q|
    next if q.ratings.empty?

    variance = Query.ratings_variance(q.ratings).first.rating # change rating to something else for Nate

    relative_variance = variance / max_label

    case_variance_values << relative_variance
  end

  json.case_rating_variance Query.mean(case_variance_values)
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
