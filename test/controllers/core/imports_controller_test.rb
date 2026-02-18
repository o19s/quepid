# frozen_string_literal: true

require "test_helper"

module Core
  class ImportsControllerTest < ActionDispatch::IntegrationTest
    setup do
      @user = users(:doug)
      login_user_for_integration_test(@user)
      @case = cases(:one)
    end

    test "ratings imports hash sync when small" do
      ratings = [
        { query_text: "test query", doc_id: "doc1", rating: "3" }
      ]
      post case_import_ratings_path(@case),
           params: { file_format: "hash", clear_queries: false, ratings: ratings.to_json },
           as: :turbo_stream
      assert_response :ok
    end

    test "ratings imports csv format as hash when client sends file_format csv" do
      # Client sends file_format: "csv" for pasted CSV (parsed to ratings client-side)
      ratings = [
        { query_text: "test query", doc_id: "doc1", rating: "3" }
      ]
      post case_import_ratings_path(@case),
           params: { file_format: "csv", clear_queries: false, ratings: ratings.to_json },
           as: :turbo_stream
      assert_response :ok
    end

    test "information_needs imports csv" do
      csv = "query,information_need\ntest query,Need for testing"
      post case_import_information_needs_path(@case),
           params: { csv_text: csv, create_queries: true },
           as: :turbo_stream
      assert_response :ok
    end

    test "information_needs returns error for empty csv" do
      post case_import_information_needs_path(@case),
           params: { csv_text: "", create_queries: false },
           as: :turbo_stream
      assert_response :unprocessable_entity
    end
  end
end
