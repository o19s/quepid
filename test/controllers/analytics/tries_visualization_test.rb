# frozen_string_literal: true

require 'test_helper'

module Analytics
  class TriesVisualizationControllerTest < ActionController::TestCase
    let(:user) { users(:joey) }

    setup do
      @controller = Analytics::TriesVisualizationController.new
      login_user user
    end

    describe 'Fetches tries for a case in vega data format' do
      let(:case_with_two_tries) { cases(:case_with_two_tries) }

      test 'formats in the vega tree format' do
        get :vega_data, params: { case_id: case_with_two_tries.id, format: :json }

        assert_response :ok

        tries = response.parsed_body
        assert_equal 2, tries.size

        tries.each do |json_try|
          assert_not_nil json_try['id']
          assert_not_nil json_try['name']
        end
      end
    end

    describe 'a case this user cannot access' do
      let(:matt_case) { cases(:matt_case) } # owned by a different user, not public, not shared with joey

      test 'renders the 404 page instead of crashing on a nil @case' do
        get :show, params: { case_id: matt_case.id }

        assert_response :not_found
      end

      test 'vega_data renders a JSON 404 instead of crashing on a nil @case' do
        get :vega_data, params: { case_id: matt_case.id, format: :json }

        assert_response :not_found
        assert_equal 'Case not found!', response.parsed_body['message']
      end

      test 'vega_specification renders a JSON 404 instead of crashing on a nil @case' do
        get :vega_specification, params: { case_id: matt_case.id, format: :json }

        assert_response :not_found
        assert_equal 'Case not found!', response.parsed_body['message']
      end
    end

    describe 'Fetches the vega specification for a case' do
      let(:case_with_two_tries) { cases(:case_with_two_tries) }

      test 'renders successfully for a case the user can access' do
        get :vega_specification, params: { case_id: case_with_two_tries.id, format: :json }

        assert_response :ok
      end
    end
  end
end
