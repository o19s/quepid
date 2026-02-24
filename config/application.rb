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

    # == SSL Specific Settings
    # Note, if true then this will allow Quepid to ONLY talk to HTTPS based search engines.
    config.force_ssl = true if 'true' == ENV['FORCE_SSL']
    config.assume_ssl = true if 'true' == ENV['ASSUME_SSL']
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
