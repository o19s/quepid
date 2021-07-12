# frozen_string_literal: true

require_relative 'boot'

require 'rails/all'

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module Quepid
  class Application < Rails::Application
    # Use the responders controller from the responders gem
    config.app_generators.scaffold_controller :responders_controller

    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 6.1

    # Configuration for the application, engines, and railties goes here.
  	#
  	# These settings can be overridden in specific environments using the files
  	# in config/environments, which are processed later.
  	#
  	# config.time_zone = "Central Time (US & Canada)"
  	# config.eager_load_paths << Rails.root.join("extras")

    config.angular_templates.ignore_prefix = %w[templates/ components/]

    config.active_job.queue_adapter = :sidekiq

    # == SSL Specific Settings
    config.force_ssl = true if 'true' == ENV['FORCE_SSL']
    # rubocop:disable Style/YodaCondition
    # rubocop:disable Style/StabbyLambdaParentheses
    # rubocop:disable Layout/LineLength
    # rubocop:disable Layout/SpaceInLambdaLiteral
    config.ssl_options = { secure_cookies: false, hsts: false, redirect: { exclude: -> request { request.path =~ /api/ or request.path =~ /assets/ or request.path =~ /case/ or request.path == '/' } } }
    # rubocop:enable Style/YodaCondition
    # rubocop:enable Style/StabbyLambdaParentheses
    # rubocop:enable Layout/LineLength
    # rubocop:enable Layout/SpaceInLambdaLiteral
  end
end
