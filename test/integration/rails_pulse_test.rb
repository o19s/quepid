# frozen_string_literal: true

require 'test_helper'

class RailsPulseTest < ActionDispatch::IntegrationTest
  class ProbeJob < ApplicationJob
    def perform message
      raise ArgumentError, message if 'pulse failure' == message

      User.count
    end
  end

  setup do
    @show_exceptions = Rails.application.env_config['action_dispatch.show_exceptions']
    Rails.application.env_config['action_dispatch.show_exceptions'] = :all
    @bullet_enabled = Bullet.enable?
    Bullet.enable = false
    RailsPulse::SchemaCheck.reset!
  end

  teardown do
    Rails.application.env_config['action_dispatch.show_exceptions'] = @show_exceptions
    Bullet.enable = @bullet_enabled
    RequestStore.clear!
    RailsPulse::SchemaCheck.reset!
  end

  test 'anonymous and ordinary users cannot reach the dashboard or its data pages' do
    [ '/admin/rails_pulse', '/admin/rails_pulse/requests' ].each do |path|
      get path
      assert_response :not_found
    end

    login users(:random)

    [ '/admin/rails_pulse', '/admin/rails_pulse/requests' ].each do |path|
      get path
      assert_response :not_found
    end
  end

  test 'administrators can navigate from the admin home to the dashboard' do
    login users(:admin)

    get '/admin'
    assert_response :success
    assert_select 'a[href="/admin/rails_pulse"][data-turbo="false"]', text: 'Rails Pulse'

    get '/admin/rails_pulse'
    assert_response :success
    assert_includes response.body, 'Rails Pulse'
  end

  test 'engine keeps upstream authentication defaults and its predicate fails closed' do
    config = RailsPulse.configuration
    assert_equal !Rails.env.local?, config.authentication_enabled

    controller = Struct.new(:session)
    assert config.authorize.call(controller.new({ 'current_user_id' => users(:admin).id }))
    assert_not config.authorize.call(controller.new({ 'current_user_id' => users(:random).id }))
    assert_not config.authorize.call(controller.new({ 'current_user_id' => -1 }))
    assert_not config.authorize.call(controller.new({}))
  end

  test 'records ordinary requests and normalized queries without raw SQL' do
    login users(:random)

    assert_difference 'RailsPulse::Request.count', 1 do
      get cases_path
      assert_response :success
    end

    request = RailsPulse::Request.order(:id).last
    assert_equal 'GET', request.method
    assert_equal 200, request.status
    assert_equal 'cases#index', request.route.controller_action
    operations = RailsPulse::Operation.where(request_id: request.id)
    assert_predicate operations.where.not(query_id: nil), :exists?
    assert_empty operations.where.not(actual_sql: nil)
  end

  test 'dashboard requests are excluded from monitoring' do
    login users(:admin)

    assert_no_difference 'RailsPulse::Request.count' do
      get '/admin/rails_pulse'
      assert_response :success
    end
  end

  test 'job instrumentation retains results and failures without storing arguments' do
    assert_equal User.count, ProbeJob.perform_now('private-token')
    run = RailsPulse::JobRun.order(:id).last
    assert_equal 'success', run.status
    assert_equal 'solid_queue', run.adapter
    assert_nil run.arguments
    assert_predicate RailsPulse::Operation.where(job_run_id: run.id), :exists?

    error = assert_raises(ArgumentError) { ProbeJob.perform_now('pulse failure') }
    assert_equal 'pulse failure', error.message
    run = RailsPulse::JobRun.order(:id).last
    assert_equal 'failed', run.status
    assert_equal 'ArgumentError', run.error_class
    assert_nil run.arguments
  end

  test 'summary and cleanup jobs aggregate requests and retain recent data' do
    get rails_health_check_path
    recent = RailsPulse::Request.order(:id).last
    hour = 1.hour.ago.beginning_of_hour
    recent.update!(occurred_at: hour + 5.minutes, created_at: hour + 5.minutes)

    RailsPulse::SummaryJob.perform_now(hour)
    assert_predicate RailsPulse::Summary.where(summarizable: recent.route, period_type: 'hour', period_start: hour), :exists?

    old = recent.dup
    old.request_uuid = SecureRandom.uuid
    old.occurred_at = 31.days.ago
    old.created_at = 31.days.ago
    old.save!

    RailsPulse::CleanupJob.perform_now
    assert_not RailsPulse::Request.exists?(old.id)
    assert RailsPulse::Request.exists?(recent.id)
  end

  private

  def login user
    post users_login_path, params: { user: { email: user.email, password: 'password' } }, as: :json
    assert_response :success
  end
end
