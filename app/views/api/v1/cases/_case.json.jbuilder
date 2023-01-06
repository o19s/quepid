# frozen_string_literal: true

shallow  ||= false
no_tries ||= false
no_teams ||= false

teams = acase.teams.find_all { |t| current_user.teams.all.include?(t) } unless no_teams

json.case_name        acase.case_name
json.caseNo           acase.id
json.scorerId         acase.scorer_id
json.bookId           acase.book_id
json.bookName         acase.book.name if acase.book.present?
json.owned            acase.owner_id == current_user.id
json.owner_name       acase.owner.name if acase.owner.present?
json.queriesCount     acase.queries.count
json.public           acase.public.presence || false

json.last_try_number acase.tries.latest.try_number unless no_tries || acase.tries.blank? || acase.tries.latest.blank?

json.teams teams unless no_teams

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
