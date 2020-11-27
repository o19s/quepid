# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    module Queries
      class ThresholdsControllerTest < ActionController::TestCase
        let(:user)  { users(:random) }
        let(:acase) { cases(:queries_case) }
        let(:query) { queries(:first_query) }

        before do
          @controller = Api::V1::Queries::ThresholdsController.new

          login_user user
        end

        describe 'Updates query threshold' do
          test 'sets the query threshold attribute' do
            put :update, params: { case_id: acase.id, query_id: query.id, query: { threshold: 1 } }

            assert_response :ok

            data = JSON.parse(response.body)

            query.reload
            assert_equal  query.threshold, 1

            assert_equal  data['threshold'],      1
            assert_equal  data['thresholdEnbl'],  false
          end

          test 'sets the query threshold enabled flag' do
            query.threshold = 1
            query.save

            put :update, params: { case_id: acase.id, query_id: query.id, query: { threshold_enbl: true } }

            assert_response :ok

            data = JSON.parse(response.body)

            query.reload
            assert_equal  query.threshold,      1
            assert_equal  query.threshold_enbl, true

            assert_equal  data['threshold'],      1
            assert_equal  data['thresholdEnbl'],  true
          end

          describe 'analytics' do
            test 'posts event' do
              expects_any_ga_event_call

              perform_enqueued_jobs do
                put :update, params: { case_id: acase.id, query_id: query.id, query: { threshold: 1 } }

                assert_response :ok
              end
            end
          end
        end
      end
    end
  end
end
