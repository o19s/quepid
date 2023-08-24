# frozen_string_literal: true

json.all_judgements do
  json.array! @judgements, partial: 'judgement', as: :judgement, locals: {}
end
