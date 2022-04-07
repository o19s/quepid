# frozen_string_literal: true

# Redis and Sidekiq is used only for sending Google Analytics updates, which is
# primarily used by the app.quepid.com install.  This checks if we need Sidekiq.
if Rails.application.config.google_analytics_enabled
  Sidekiq::Extensions.enable_delay!

  sidekiq_config = { url:        ENV['REDIS_URL'],
                     ssl_params: { verify_mode: OpenSSL::SSL::VERIFY_NONE } }

  Sidekiq.configure_server do |config|
    config.redis = sidekiq_config
  end

  Sidekiq.configure_client do |config|
    config.redis = sidekiq_config
  end
end
