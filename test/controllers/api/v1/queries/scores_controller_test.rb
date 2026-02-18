# frozen_string_literal: true

require "test_helper"

module Api
  module V1
    module Queries
      class ScoresControllerTest < ActionDispatch::IntegrationTest
        let(:user) { users(:random) }
        let(:acase) { cases(:queries_case) }
        let(:query) { queries(:first_query) }

        before do
          login_user_for_integration_test user
        end

        test "returns score for a query" do
          # Ensure the case has a scorer
          scorer = acase.scorer
          assert scorer.present?, "Case must have a scorer for this test"

          post api_case_query_score_url(acase, query),
               headers: { "Content-Type" => "application/json", "Accept" => "application/json" }

          assert_response :success
          body = response.parsed_body
          assert body.key?("query_id")
          assert_equal query.id, body["query_id"]
          assert body.key?("score")
          assert body.key?("max_score")
        end

        test "returns 404 for non-existent query" do
          post api_case_query_score_url(acase, 999999),
               headers: { "Content-Type" => "application/json", "Accept" => "application/json" }

          assert_response :not_found
        end
      end
    end
  end
end
