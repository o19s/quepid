# frozen_string_literal: true

json.teams do
  json.array! @teams, partial: 'team', as: :team, locals: { load_cases: @load_cases }
end
