# frozen_string_literal: true

json.array!(@users) do |user|
  json.extract! user, :id, :agreed_time
  json.url admin_user_url(user, format: :json)
end
