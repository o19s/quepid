# frozen_string_literal: true

require 'test_helper'
require 'csv'
module Api
  module V1
    module Export
      class CasesControllerTest < ActionController::TestCase
        let(:user) { users(:random) }

        before do
          @controller = Api::V1::Export::CasesController.new

          login_user user
        end

        describe 'Exporting a case in json' do
          let(:acase) { cases(:queries_case) }

          test 'the AR object ids are replaced with names' do
            get :show, params: { case_id: acase.id }
            assert_response :ok
            body = response.parsed_body

            assert_nil body['case_id']
            assert_not_nil body['case_name']

            assert_nil body['scorer_id']
            assert_not_nil body['scorer']
            assert_nil body['scorer']['scorer_id']

            assert_not_nil body['try']
            assert_not_empty body['try']['curator_variables']
          end
        end
      end
    end
  end
end
