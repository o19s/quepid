# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    module Bulk
      class QueriesControllerTest < ActionController::TestCase
        let(:user)  { users(:random) }
        let(:acase) { cases(:queries_case) }

        before do
          @controller = Api::V1::Bulk::QueriesController.new

          login_user user

          acase.queries.delete_all
        end

        describe 'Adds an array of queries' do
          test 'adds all queries provided' do
            data = {
              case_id: acase.id,
              queries: %w[one two three four],
            }

            assert_difference 'acase.queries.count', 4 do
              post :create, params: data
            end
          end

          test 'adds queries in the specified order' do
            data = {
              case_id: acase.id,
              queries: %w[one two three four],
            }

            post :create, params: data

            acase.reload

            first_query = acase.queries.first

            assert_equal 'one', first_query.query_text
            assert_equal json_response['display_order'][0], first_query.id
          end

          test 'doesnt allow duplicate queries to be created' do
            data = {
              case_id: acase.id,
              queries: %w[one two three four],
            }

            post :create, params: data

            acase.reload

            assert_equal 4, acase.queries.size

            data = {
              case_id: acase.id,
              queries: %w[one two three four five],
            }

            post :create, params: data

            acase.reload

            assert_equal 5, acase.queries.size
          end
        end

        describe 'Deletes all queries for a case.' do
          test 'deletes all' do
            data = {
              case_id: acase.id,
            }

            assert_difference 'acase.queries.count', 0 do
              delete :destroy, params: data
            end
          end
        end
      end
    end
  end
end
