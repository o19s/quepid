# frozen_string_literal: true

Sidekiq::Extensions.enable_delay!

sidekiq_config = { url: ENV['REDIS_URL'],
                   ssl_params: { verify_mode: OpenSSL::SSL::VERIFY_NONE }
                 }

Sidekiq.configure_server do |config|
  config.redis = sidekiq_config
end

Sidekiq.configure_client do |config|
  config.redis = sidekiq_config
end
