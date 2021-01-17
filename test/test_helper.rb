# frozen_string_literal: true

require 'simplecov'
SimpleCov.start

ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'
require 'rails/test_help'
require 'minitest/reporters'
require 'minitest/spec'
require 'mocha/minitest'
require 'webmock/minitest'

Dir[Rails.root.join('test/support/**/*.rb')].sort
  .each { |f| require f }

Minitest::Reporters.use! [ Minitest::Reporters::ProgressReporter.new, Minitest::Reporters::JUnitReporter.new ]

module ActiveSupport
  class TestCase
    include ActiveJob::TestHelper

    # Setup all fixtures in test/fixtures/*.yml for all tests in alphabetical order.
    fixtures :all

    extend MiniTest::Spec::DSL

    # Add more helper methods to be used by all tests here...
    def login_user user = nil
      user ||= @user
      @controller.send(:auto_login, user)
    end
  end
end
