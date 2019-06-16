# frozen_string_literal: true

json.annotations do
  json.array! @annotations, partial: 'annotation', as: :annotation
end
