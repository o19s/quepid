# frozen_string_literal: true

require 'active_support/core_ext/integer/time'

# rubocop:disable Metrics/BlockLength

Rails.application.configure do
  # Settings specified here will take precedence over those in config/application.rb.

  # Code is not reloaded between requests.
  config.enable_reloading = false

  # Eager load code on boot for better performance and memory savings (ignored by Rake tasks).
  config.eager_load = true

  # Full error reports are controlled by a setting and caching is turned on.
  # Let's be able to see error messages if needed.
  config.consider_all_requests_local = ENV['QUEPID_CONSIDER_ALL_REQUESTS_LOCAL'].present?

  config.action_controller.default_protect_from_forgery = false

  # This may not be needed
  # Disable serving static files from `public/`, relying on NGINX/Apache to do so instead.
  config.public_file_server.enabled = ENV['RAILS_SERVE_STATIC_FILES'].present?

  # Cache assets for far-future expiry since they are all digest stamped.
  config.public_file_server.headers = { 'cache-control' => "public, max-age=#{1.year.to_i}" }

  # Do not fallback to assets pipeline if a precompiled asset is missed.
  config.assets.compile = false

  # Turn on fragment caching in view templates.
  config.action_controller.perform_caching = true

  # `config.assets.precompile` and `config.assets.version` have moved to config/initializers/assets.rb

  # Store uploaded files on the local file system (see config/storage.yml for options).
  config.active_storage.service = :db # :local

  # Enable detailed ActionCable logging
  config.action_cable.log_tags = [
    :channel,
    :connection,
    :transmissions,
    :state_updates
  ]

  config.action_cable.disable_request_forgery_protection = true
  config.action_cable.allowed_request_origins = '*'

  # needs updates in thurster world
  # Assume all access to the app is happening through a SSL-terminating reverse proxy.
  # Can be used together with config.force_ssl for Strict-Transport-Security and secure cookies.
  # config.assume_ssl = false

  # Force all access to the app over SSL, use Strict-Transport-Security, and use secure cookies.
  # config.force_ssl = false

  # Skip http-to-https redirect for the default health check endpoint.
  # config.ssl_options = { redirect: { exclude: ->(request) { request.path == "/up" } } }

  # Log to STDOUT with the current request id as a default log tag.
  config.log_tags = [ :request_id ]
  #config.logger   = ActiveSupport::TaggedLogging.logger($stdout)

  # Change to "debug" to log everything (including potentially personally-identifiable information!)
  config.log_level = ENV.fetch('RAILS_LOG_LEVEL', 'info')

  # Prevent health checks from clogging up the logs.
  # config.silence_healthcheck_path = "/up"

  # Don't log any deprecations.
  config.active_support.report_deprecations = false

  # Replace the default in-process memory cache store with a durable alternative.
  # config.cache_store = :mem_cache_store

  config.active_job.queue_adapter = :solid_queue
  config.solid_queue.connects_to = { database: { writing: :primary, reading: :primary } }
  config.solid_queue.silence_polling = true

  # Ignore bad email addresses and do not raise email delivery errors.
  # Set this to true and configure the email server for immediate delivery to raise delivery errors.
  # config.action_mailer.raise_delivery_errors = false

  # Enable locale fallbacks for I18n (makes lookups for any locale fall back to
  # the I18n.default_locale when a translation cannot be found).
  config.i18n.fallbacks = true

  # Do not dump schema after migrations.
  config.active_record.dump_schema_after_migration = false

  # Enable DNS rebinding protection and other `Host` header attacks.
  # config.hosts = [
  #   "example.com",     # Allow requests from example.com
  #   /.*\.example\.com/ # Allow requests from subdomains like `www.example.com`
  # ]
  #
  # Skip DNS rebinding protection for the default health check endpoint.
  # config.host_authorization = { exclude: ->(request) { request.path == "/up" } }

  # Set host to be used by links generated in mailer templates.
  # config.action_mailer.default_url_options = { host: ENV.fetch('QUEPID_DOMAIN', nil) }

  if ENV['QUEPID_DOMAIN'].present?
    # Set default URL options for all URL helpers
    config.action_controller.default_url_options = { host: ENV['QUEPID_DOMAIN'], protocol: ENV.fetch('QUEPID_PROTOCOL', nil) }
    config.action_controller.asset_host = "#{ENV.fetch('QUEPID_PROTOCOL', nil)}://#{ENV['QUEPID_DOMAIN']}"
    config.action_mailer.asset_host = "#{ENV.fetch('QUEPID_PROTOCOL', nil)}://#{ENV['QUEPID_DOMAIN']}"

    config.action_mailer.default_url_options = {
      host: ENV['QUEPID_DOMAIN'], protocol: ENV.fetch('QUEPID_PROTOCOL', nil)
    }

    Rails.application.routes.default_url_options = { host: ENV['QUEPID_DOMAIN'], protocol: ENV.fetch('QUEPID_PROTOCOL', nil) }
  end

  # Specify outgoing SMTP server. Remember to add smtp/* credentials via bin/rails credentials:edit.
  # config.action_mailer.smtp_settings = {
  #   user_name: Rails.application.credentials.dig(:smtp, :user_name),
  #   password: Rails.application.credentials.dig(:smtp, :password),
  #   address: "smtp.example.com",
  #   port: 587,
  #   authentication: :plain
  # }

  config.mission_control.jobs.http_basic_auth_enabled = false

  config.active_storage.variant_processor = :disabled
end
# rubocop:enable Metrics/BlockLength
