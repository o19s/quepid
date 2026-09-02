# frozen_string_literal: true

require_relative 'boot'

require 'rails'
# Pick the frameworks you want:
# Alternative to require 'rails/all'
require 'active_model/railtie'
require 'active_job/railtie'
require 'active_record/railtie'
require 'active_storage/engine'
require 'action_controller/railtie'
require 'action_mailer/railtie'
# require "action_mailbox/engine"
# require "action_text/engine"
require 'action_view/railtie'
require 'action_cable/engine'
require 'rails/test_unit/railtie'

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module Quepid
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 8.1

    # Please, add to the `ignore` list any other `lib` subdirectories that do
    # not contain `.rb` files, or that should not be reloaded or eager loaded.
    # Common ones are `templates`, `generators`, or `middleware`, for example.
    config.autoload_lib(ignore: %w[assets tasks])

    # Configuration for the application, engines, and railties goes here.
    #
    # These settings can be overridden in specific environments using the files
    # in config/environments, which are processed later.
    #
    # config.time_zone = "Central Time (US & Canada)"
    # config.eager_load_paths << Rails.root.join("extras")

    config.active_job.queue_adapter = :solid_queue

    # == ActiveRecord Encryption Settings
    # Enable encryption for sensitive data.  Someday, when our database doesn't have potentially mixed encryption state, this should be set to false.
    # Maybe in Quepid 9?
    config.active_record.encryption.support_unencrypted_data = true
    sqlite_adapter = ENV.fetch('DB_ADAPTER', nil) == 'sqlite3' || ENV.fetch('DATABASE_URL', '').start_with?('sqlite3:')
    config.active_record.dump_schema_after_migration = false if sqlite_adapter

    # Encryption keys must be set here (not in config/initializers/) so they are in
    # place before the active_record.encryption Railtie initializer copies them into
    # ActiveRecord::Encryption.config. We provide defaults, but you should set your
    # own keys via env vars in production and NOT lose them.
    config.active_record.encryption.primary_key         = ENV.fetch('ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY',         'bnYX3NlvUJxHWXwNYBgP33yi8BKlN7Ml')
    config.active_record.encryption.deterministic_key   = ENV.fetch('ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY',   'OItaH6HSftjoxkl9QDejPAmQ8EaFOlwk')
    config.active_record.encryption.key_derivation_salt = ENV.fetch('ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT', 'BzPDVAl1jAUquD4p7rM9J40wAwf7CCFh')

    # == SSL Specific Settings
    # Note, if true then this will allow Quepid to ONLY talk to HTTPS based search engines.
    config.force_ssl = true if 'true' == ENV['FORCE_SSL']
    # rubocop:disable Style/StabbyLambdaParentheses
    # rubocop:disable Layout/SpaceInLambdaLiteral
    # rubocop:disable Layout/HashAlignment
    config.ssl_options = {
      secure_cookies: false,
      hsts: false,
      redirect: {
        exclude: -> request {
          request.path =~ /api/ or request.path =~ /assets/ or request.path =~ /case/ or '/' == request.path
        },
      },
    }
    # rubocop:enable Style/StabbyLambdaParentheses
    # rubocop:enable Layout/SpaceInLambdaLiteral
    # rubocop:enable Layout/HashAlignment
  end
end
