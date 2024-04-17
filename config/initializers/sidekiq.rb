# frozen_string_literal: true

# Redis and Sidekiq is used only for sending Google Analytics updates, which is
# primarily used by the app.quepid.com install.  This checks if we need Sidekiq.
# if Rails.application.config.google_analytics_enabled

sidekiq_config = { url:        ENV.fetch('REDIS_URL', nil),
                   ssl_params: { verify_mode: OpenSSL::SSL::VERIFY_NONE } }

Sidekiq.configure_server do |config|
  config.redis = sidekiq_config
  config.capsule('unsafe') do |cap|
    cap.concurrency = 1
    cap.queues = %w[single]
  end
end

Sidekiq.configure_client do |config|
  config.redis = sidekiq_config
end
# end
