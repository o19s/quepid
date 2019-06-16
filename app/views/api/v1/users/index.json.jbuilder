# frozen_string_literal: true

json.users do
  json.array! @users, partial: 'user', as: :user
end
