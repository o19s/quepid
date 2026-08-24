# frozen_string_literal: true

require 'test_helper'

class CasesControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:random) }

  setup do
    login_user_for_integration_test user
  end

  test 'index renders body with data-quepid-root-url for Stimulus navigation' do
    Bullet.enable = false
    get cases_url
    Bullet.enable = true

    assert_response :success
    expected_root = root_url.chomp('/')
    assert_select 'body[data-quepid-root-url=?]', expected_root
    assert_select '[data-controller="import-case"]#importCaseModal'
  end
end
