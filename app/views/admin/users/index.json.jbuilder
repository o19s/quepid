# frozen_string_literal: true

@shallow ||= false

json.array!(@users) do |user|
  json.bob @shallow
  json.extract! user, :id, :name, :email, :email_marketing, :agreed_time, :agreed
  json.extract! user, :password, :administrator, :company, :completed_case_wizard unless @shallow
  json.url admin_user_url(user, format: :json)
end
