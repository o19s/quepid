# frozen_string_literal: true

json.cases do
  json.array! @cases, partial: 'api/v1/cases/case', as: :acase
end
