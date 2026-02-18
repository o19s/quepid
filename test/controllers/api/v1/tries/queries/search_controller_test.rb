# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    module Tries
      module Queries
        class SearchControllerTest < ActionController::TestCase
          let(:user)  { users(:doug) }
          let(:acase) { cases(:one) }
          let(:atry)  { tries(:one) }
          let(:query) { queries(:one) }

          before do
            @controller = Api::V1::Tries::Queries::SearchController.new
            login_user user
            atry.update!(search_endpoint: search_endpoints(:one))
          end

          test 'returns 404 when case not found' do
            get :show, params: { case_id: 999_999, try_try_number: atry.try_number, query_id: query.id }
            assert_response :not_found
          end

          test 'returns 404 when try not found' do
            get :show, params: { case_id: acase.id, try_try_number: 999, query_id: query.id }
            assert_response :not_found
          end

          test 'returns 404 when query not found' do
            get :show, params: { case_id: acase.id, try_try_number: atry.try_number, query_id: 999_999 }
            assert_response :not_found
          end

          test 'returns 400 when no search endpoint' do
            atry.update!(search_endpoint: nil)
            get :show, params: { case_id: acase.id, try_try_number: atry.try_number, query_id: query.id }
            assert_response :bad_request
            json = response.parsed_body
            assert json['error'].present?
          end

          test 'returns 400 when static search engine' do
            atry.search_endpoint.update!(search_engine: 'static')
            get :show, params: { case_id: acase.id, try_try_number: atry.try_number, query_id: query.id }
            assert_response :bad_request
            json = response.parsed_body
            assert_match /static/i, json['error']
          end

          test 'returns docs and num_found when search succeeds' do
            stub_request(:get, %r{http://test\.com/solr/tmdb/select})
              .to_return(
                status:  200,
                body:    {
                  'response' => {
                    'numFound' => 2,
                    'docs' => [
                      { 'id' => 'doc1', 'title' => [ 'Title 1' ] },
                      { 'id' => 'doc2', 'title' => [ 'Title 2' ] }
                    ]
                  }
                }.to_json,
                headers: { 'Content-Type' => 'application/json' }
              )

            get :show, params: { case_id: acase.id, try_try_number: atry.try_number, query_id: query.id }, format: :json

            assert_response :success
            json = response.parsed_body
            assert json["docs"].is_a?(Array)
            assert json['num_found'].present?
            assert json['ratings'].is_a?(Hash)
            assert_equal 200, json['response_status']
          end

          test 'accepts q param for custom query text (DocFinder)' do
            stub_request(:get, %r{http://test\.com/solr/tmdb/select})
              .with(query: hash_including('q' => 'custom search'))
              .to_return(
                status:  200,
                body:    {
                  'response' => {
                    'numFound' => 1,
                    'docs' => [ { 'id' => 'doc1', 'title' => [ 'Custom Result' ] } ]
                  }
                }.to_json,
                headers: { 'Content-Type' => 'application/json' }
              )

            get :show, params: { case_id: acase.id, try_try_number: atry.try_number, query_id: query.id, q: "custom search" }, format: :json

            assert_response :success
            json = response.parsed_body
            assert_equal 1, json["docs"].length
            assert_equal "doc1", json["docs"].first["id"]
          end

          test "returns HTML document cards when Accept text/html" do
            stub_request(:get, %r{http://test\.com/solr/tmdb/select})
              .to_return(
                status:  200,
                body:    {
                  "response" => {
                    "numFound" => 1,
                    "docs" => [ { "id" => "doc1", "title" => [ "Title 1" ] } ]
                  }
                }.to_json,
                headers: { "Content-Type" => "application/json" }
              )

            request.env["HTTP_ACCEPT"] = "text/html"
            get :show, params: { case_id: acase.id, try_try_number: atry.try_number, query_id: query.id }

            assert_response :success
            assert_includes response.body, "document-card"
            assert_includes response.body, "data-doc-id=\"doc1\""
            assert_includes response.body, "rating-badge-doc1"
          end

          test "returns HTML with diff entries when diff_snapshot_ids provided" do
            # Create a snapshot with docs for this query
            snapshot = Snapshot.create!(case: acase, name: "Test Snapshot")
            sq = SnapshotQuery.create!(snapshot: snapshot, query: query, score: 1.0)
            SnapshotDoc.create!(snapshot_query: sq, doc_id: "doc1", position: 3,
                                fields: '{"title":"Title 1"}')

            stub_request(:get, %r{http://test\.com/solr/tmdb/select})
              .to_return(
                status:  200,
                body:    {
                  "response" => {
                    "numFound" => 2,
                    "docs" => [
                      { "id" => "doc1", "title" => [ "Title 1" ] },
                      { "id" => "doc_new", "title" => [ "New Doc" ] }
                    ]
                  }
                }.to_json,
                headers: { "Content-Type" => "application/json" }
              )

            request.env["HTTP_ACCEPT"] = "text/html"
            get :show, params: {
              case_id: acase.id,
              try_try_number: atry.try_number,
              query_id: query.id,
              diff_snapshot_ids: [ snapshot.id ]
            }

            assert_response :success
            assert_includes response.body, "data-diff-active"
            # Side-by-side diff: snapshot column shows doc1 at position 3 with improved status
            assert_includes response.body, "diff-comparison"
            assert_includes response.body, "Test Snapshot"
            # doc_new is not in the snapshot — shows "New in current" in the legend/status
            assert_includes response.body, "New in current"
          end

          test "returns HTML without diff when diff_snapshot_ids is empty" do
            stub_request(:get, %r{http://test\.com/solr/tmdb/select})
              .to_return(
                status:  200,
                body:    {
                  "response" => {
                    "numFound" => 1,
                    "docs" => [ { "id" => "doc1", "title" => [ "Title 1" ] } ]
                  }
                }.to_json,
                headers: { "Content-Type" => "application/json" }
              )

            request.env["HTTP_ACCEPT"] = "text/html"
            get :show, params: {
              case_id: acase.id,
              try_try_number: atry.try_number,
              query_id: query.id,
              diff_snapshot_ids: []
            }

            assert_response :success
            assert_not_includes response.body, "data-diff-active"
            assert_not_includes response.body, "new in current"
          end
        end
      end
    end
  end
end
