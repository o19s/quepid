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

      test 'renders external ancestry as a root without changing stored parents' do
        first_try, second_try = case_with_two_tries.tries.order(:id).to_a
        first_try.update! parent: tries(:one)
        second_try.update! parent: nil
        original_ancestry = first_try.ancestry

        get :vega_data, params: { case_id: case_with_two_tries.id, format: :json }

        assert_response :ok
        rows = response.parsed_body
        assert_equal 3, rows.size
        ids = rows.pluck('id')
        assert_equal ids.size, ids.uniq.size
        root_count = rows.count { |row| row['parent'].nil? }
        assert_equal 1, root_count
        rows.each { |row| assert_includes ids, row['parent'] if row['parent'] }
        assert_equal original_ancestry, first_try.reload.ancestry
      end
    end

    describe 'a case this user cannot access' do
      let(:matt_case) { cases(:matt_case) } # owned by a different user, not public, not shared with joey

      test 'renders the 404 page instead of crashing on a nil @case' do
        get :show, params: { case_id: matt_case.id }

        assert_response :not_found
        # `render_not_found_json`'s JSON 404 is also :not_found -- pin the HTML page specifically
        # so a regression to the JSON response fails.
        assert_match "doesn't exist (404 Not found)", response.body
        assert_no_match 'Case not found!', response.body
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
