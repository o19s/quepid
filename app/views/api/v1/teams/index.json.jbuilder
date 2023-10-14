# frozen_string_literal: true

json.teams do
  json.array! @teams, partial: 'team', as: :team, locals: { for_sharing: @for_sharing }
end
