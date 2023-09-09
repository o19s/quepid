# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    module Snapshots
      class SearchControllerTest < ActionController::TestCase
        let(:user) { users(:random) }

        before do
          @controller = Api::V1::Snapshots::SearchController.new

          login_user user
        end

        describe 'searches a snapshot for a specific query' do
          let(:acase)     { cases(:snapshot_case) }
          let(:snapshot)  { snapshots(:a_snapshot) }

          test 'does a search for a specific query' do
            snapshot_query = snapshot.snapshot_queries.first
            query_text = snapshot_query.query.query_text

            get :index, params: { case_id: acase.id, snapshot_id: snapshot.id, q: query_text }

            assert_response :ok

            data = response.parsed_body

            assert_equal query_text, data['responseHeader']['params']['q']
            assert_equal snapshot_query.snapshot_docs.count, data['response']['docs'].length
          end

          test 'handles a *:* search' do
            get :index, params: { case_id: acase.id, snapshot_id: snapshot.id, q: '*:*' }

            assert_response :ok

            data = response.parsed_body

            assert_equal '*:*', data['responseHeader']['params']['q']
            assert_equal 2, data['response']['docs'].length
          end

          test 'handles a query that doesnt match any snapshotted queries' do
            get :index, params: { case_id: acase.id, snapshot_id: snapshot.id, q: 'missing query' }

            assert_response :ok

            data = response.parsed_body

            assert_equal 'missing query', data['responseHeader']['params']['q']
            assert_equal 0, data['response']['docs'].length
          end

          test 'looks up an individual doc by its ID' do
            snapshot_query = snapshot.snapshot_queries.first
            doc_id = snapshot_query.snapshot_docs.first.doc_id
            query_text = "id:#{doc_id}"

            get :index, params: { case_id: acase.id, snapshot_id: snapshot.id, q: query_text }

            assert_response :ok

            data = response.parsed_body

            assert_equal query_text, data['responseHeader']['params']['q']
            assert_equal 1, data['response']['docs'].length
          end

          test 'looks up an individual doc that doesnt exist' do
            query_text = 'id:fake'

            get :index, params: { case_id: acase.id, snapshot_id: snapshot.id, q: query_text }

            assert_response :ok

            data = response.parsed_body

            assert_equal query_text, data['responseHeader']['params']['q']
            assert_equal 0, data['response']['docs'].length
          end

          test 'deals with rows' do
            snapshot_query = snapshot.snapshot_queries.first
            query_text = snapshot_query.query.query_text

            rows = 1
            get :index, params: { case_id: acase.id, snapshot_id: snapshot.id, q: query_text, rows: rows }

            assert_response :ok

            data = response.parsed_body

            assert_equal query_text, data['responseHeader']['params']['q']
            assert_equal 2, data['response']['numFound']
            assert_equal rows, data['response']['docs'].length
          end
        end
      end
    end
  end
end
