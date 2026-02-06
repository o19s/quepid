# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    module Queries
      class OptionsControllerTest < ActionController::TestCase
        let(:user)  { users(:random) }
        let(:acase) { cases(:queries_case) }
        let(:query) { queries(:first_query) }

        before do
          @controller = Api::V1::Queries::OptionsController.new

          login_user user
        end

        describe 'Fetches query options' do
          test 'returns nil if the query has no options' do
            get :show, params: { case_id: acase.id, query_id: query.id }

            assert_response :ok

            data = response.parsed_body

            assert_nil data['options']
          end

          test "return the query's options" do
            options = JSON.parse('{ "foo": "bar" }')
            query.options = options
            query.save

            get :show, params: { case_id: acase.id, query_id: query.id }

            assert_response :ok
            puts response.body
            data = response.parsed_body

            assert_equal data['options'], options
          end
        end

        describe "Updates query's options" do
          test 'sets the new query options successfully' do
            options = JSON.parse('{ "foo": "bar" }')

            put :update, params: { case_id: acase.id, query_id: query.id, query: { options: options } }

            assert_response :ok
            puts response.body
            data = response.parsed_body

            query.reload
            assert_equal  query.options,    options
            assert_equal  data['options'],  options
          end

          describe 'analytics' do
            test 'posts event' do
              expects_any_ga_event_call

              options = JSON.parse('{ "foo": "bar" }')

              perform_enqueued_jobs do
                put :update, params: { case_id: acase.id, query_id: query.id, query: { options: options } }

                assert_response :ok
              end
            end
          end
        end
      end
    end
  end
end
