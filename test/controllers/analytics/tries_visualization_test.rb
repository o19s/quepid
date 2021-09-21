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

        get :vega_data, params: { case_id: case_with_two_tries.id, format: :json}

        assert_response :ok

        tries = json_response
        assert_equal 2, tries.size

        tries.each do |json_try|
          assert_not_nil json_try['id']
          assert_not_nil json_try['name']
        end
      end
    end
  end
end
