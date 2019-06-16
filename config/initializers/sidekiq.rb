# frozen_string_literal: true

Sidekiq::Extensions.enable_delay!

sidekiq_config = { url: ENV['REDIS_URL'] }

Sidekiq.configure_server do |config|
  config.redis = sidekiq_config
end

Sidekiq.configure_client do |config|
  config.redis = sidekiq_config
end
