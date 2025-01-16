# frozen_string_literal: true

json.avatar_url      user.avatar_url
json.company         user.company
json.display_name    user.display_name
json.id              user.id
json.email           user.email
json.ai_judge        user.ai_judge?
json.default_scorer_id user.default_scorer_id

json.cases_involved_with_count user.cases_involved_with.count
json.teams_involved_with_count user.teams.count
