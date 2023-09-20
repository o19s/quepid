# frozen_string_literal: true

require 'test_helper'

class ExportImportCaseFlowTest < ActionDispatch::IntegrationTest
  include ActionMailer::TestHelper

  let(:acase) { cases(:queries_case) }
  let(:user) { users(:random) }

  test 'Export a complete case, and then modify the name, and reimport it with same users' do
    post users_login_url params: { user: { email: user.email, password: 'password' }, format: :json }

    # export the book
    Bullet.enable = false # we have extra nesting we don't care about
    get api_export_case_url(acase)
    Bullet.enable = true

    assert_response :ok

    response_json = response.parsed_body

    # Modify the book into a NEW book and import.
    response_json['case_name'] = 'New Case'

    post api_import_cases_url params: { case: response_json, format: :json }

    new_case = Case.find(response.parsed_body['id'])
    assert_not_nil(new_case)
  end
end
