# frozen_string_literal: true

json.allCases do
  json.array! @cases, partial: 'case', as: :acase, locals: { shallow: !@deep, no_tries: @no_tries, no_teams: @no_teams }
end
