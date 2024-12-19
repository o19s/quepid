# frozen_string_literal: true

shallow  ||= false
no_tries ||= false
no_teams ||= false
no_scores ||= false

json.case_name        acase.case_name
json.case_id          acase.id
json.scorer_id        acase.scorer_id
json.book_id          acase.book_id
json.owned            acase.owner_id == current_user.id if current_user.present?
json.queries_count    acase.respond_to?(:queries_count) ? acase.queries_count : acase.queries.count
json.owner_name       acase.owner.name if acase.owner.present?
json.owner_id         acase.owner.id if acase.owner.present?
json.book_name        acase.book.name if acase.book.present?
json.public           acase.public.presence || false
json.archived         acase.archived
json.options          acase.options

json.last_try_number acase.last_try_number

unless no_teams || current_user.nil?
  teams = acase.teams.find_all { |t| current_user.teams.all.include?(t) }
  json.teams teams
end

unless no_tries || shallow
  json.tries do
    json.array! acase.tries, partial: 'api/v1/tries/try', as: :try
  end
end

if !no_scores && acase.last_score.present? && acase.last_score.present?
  json.last_score do
    json.partial! 'api/v1/case_scores/score', score: acase.last_score, shallow: shallow
  end
end

unless shallow
  json.scores acase.scores.sampled(acase.id, 10).includes(:annotation).limit(10) do |s|
    json.score      s.score
    json.updated_at s.updated_at
    json.note       s.annotation&.message
  end
end
