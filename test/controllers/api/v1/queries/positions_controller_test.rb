# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    module Queries
      class PositionsControllerTest < ActionController::TestCase
        let(:user)  { users(:random) }
        let(:acase) { cases(:queries_case) }

        before do
          @controller = Api::V1::Queries::PositionsController.new

          login_user user
        end

        describe 'Updates Position' do
          test 'moves query to new position' do
            query   = acase.queries[0]
            second  = acase.queries[1]

            put :update, params: { case_id: acase.id, query_id: query.id, after: second.id }

            assert_response :ok

            acase.reload

            assert_equal query,   acase.queries[1]
            assert_equal second,  acase.queries[0]
          end

          test 'returns new display order for queries' do
            query   = acase.queries[0]
            second  = acase.queries[1]

            put :update, params: { case_id: acase.id, query_id: query.id, after: second.id }

            assert_response :ok

            display_order = json_response['displayOrder']

            assert_equal query.id,  display_order[1]
            assert_equal second.id, display_order[0]
          end

          test 'moves query to beginning of list' do
            query   = acase.queries[2]
            second  = acase.queries[0]

            put :update, params: { case_id: acase.id, query_id: query.id, after: second.id, reverse: true }

            assert_response :ok

            display_order = json_response['displayOrder']

            assert_equal query.id,  display_order[0]
            assert_equal second.id, display_order[1]
          end

          test 'moves query to end of list' do
            query   = acase.queries[1]
            second  = acase.queries.last

            put :update, params: { case_id: acase.id, query_id: query.id, after: second.id }

            assert_response :ok

            display_order = json_response['displayOrder']

            assert_equal query.id, display_order.last
          end

          test 'moves query to middle of the list forward' do
            query   = acase.queries[1]
            second  = acase.queries[2]

            put :update, params: { case_id: acase.id, query_id: query.id, after: second.id }

            assert_response :ok

            display_order = json_response['displayOrder']

            assert_equal query.id,  display_order[2]
            assert_equal second.id, display_order[1]
          end

          test 'moves query to middle of the list backwards' do
            query   = acase.queries[2]
            second  = acase.queries[1]

            put :update, params: { case_id: acase.id, query_id: query.id, after: second.id, reverse: true }

            assert_response :ok

            display_order = json_response['displayOrder']

            assert_equal query.id,  display_order[1]
            assert_equal second.id, display_order[2]
          end
        end
      end
    end
  end
end
