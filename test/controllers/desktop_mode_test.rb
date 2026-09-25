# frozen_string_literal: true

require 'test_helper'

class DesktopModeTest < ActionDispatch::IntegrationTest
  setup do
    @original_mode = Rails.application.config.desktop_mode
    @original_user_id = Rails.application.config.desktop_user_id
    @user = users(:random)
  end

  teardown do
    Rails.application.config.desktop_mode = @original_mode
    Rails.application.config.desktop_user_id = @original_user_id
  end

  test 'desktop mode authenticates the configured local user' do
    Rails.application.config.desktop_mode = true
    Rails.application.config.desktop_user_id = @user.id.to_s

    get root_path

    assert_response :success
    assert_includes response.body, @user.display_name
    refute_match(/href="\/teams/, response.body)
  end

  test 'desktop mode redirects login attempts to the application' do
    Rails.application.config.desktop_mode = true
    Rails.application.config.desktop_user_id = @user.id.to_s

    get login_path

    assert_redirected_to root_path
  end
end
