# frozen_string_literal: true

require 'simplecov'
SimpleCov.start

ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'
require 'rails/test_help'
require 'minitest/reporters'
require 'minitest/spec'
require 'webmock/minitest'

Dir[Rails.root.join('test/support/**/*.rb')]
  .each { |f| require f }

Minitest::Reporters.use! [ Minitest::Reporters::ProgressReporter.new, Minitest::Reporters::JUnitReporter.new ]

module ActiveSupport
  class TestCase
    # TODO: Remove when Devise fixes https://github.com/heartcombo/devise/issues/5705
    ActiveSupport.on_load(:action_mailer) do
      Rails.application.reload_routes_unless_loaded
    end

    include ActiveJob::TestHelper

    # Run tests in parallel with specified workers
    # parallelize(workers: :number_of_processors)

    # Setup all fixtures in test/fixtures/*.yml for all tests in alphabetical order.
    fixtures :all

    extend Minitest::Spec::DSL

    # Add more helper methods to be used by all tests here...
    def login_user user = nil
      user ||= @user
      @controller.send(:auto_login, user)
    end

    # in Minitest 6, it will fail to do an assert_equal on a nil, so weird workaround
    # to shut up deprecation warnings.
    def assert_nil_or_equal source, target
      if source.blank?
        assert_nil target
      else
        assert_equal source, target
      end
    end

    def login_user_for_integration_test user
      # We don't actually want to load up scores...
      Bullet.enable = false
      # post the login and follow through to the home page
      post '/users/login', params: { user: { email: user.email, password: 'password' } }

      # avoid the follow redirect so we dont' invoke the home_controller.'
      # follow_redirect!
      # assert_equal 200, status
      # assert_equal '/', path

      Bullet.enable = true
    end
  end
end
