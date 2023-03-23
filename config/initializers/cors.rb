# frozen_string_literal: true

# Avoid CORS issues when API is called from the frontend app.
# Handle Cross-Origin Resource Sharing (CORS) in order to accept cross-origin AJAX requests.

Rails.application.config.action_controller.forgery_protection_origin_check = false
# Read more: https://github.com/cyu/rack-cors

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins '/(.*)/'

    resource '*',
             headers:     :any,
             methods:     [ :get, :post, :put, :patch, :delete, :options, :head ],
             credentials: false
  end
end
