# frozen_string_literal: true

json.embedders do
  json.array! @embedders, partial: 'embedder', as: :embedder
end
