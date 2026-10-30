# frozen_string_literal: true

json.cases do
  json.array! @cases, partial: 'api/v1/cases/case', as: :acase, locals: { sampled_case_scores: @sampled_case_scores }
end
