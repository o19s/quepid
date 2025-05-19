# frozen_string_literal: true

json.judgements do
  json.array! @judgements, partial: 'judgement', as: :judgement, locals: {}
end
