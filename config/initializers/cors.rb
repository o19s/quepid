# frozen_string_literal: true

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins '*'
    resource '*', headers: :any, methods: [ :get, :post, :patch, :put ], credentials: true
  end
end

Rails.application.config.action_controller.forgery_protection_origin_check = false
