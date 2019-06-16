# frozen_string_literal: true

json.members do
  json.array! @members, partial: 'member', as: :member
end
