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

            assert_equal data['responseHeader']['params']['q'], query_text
            assert_equal data['response']['docs'].length, snapshot_query.snapshot_docs.count
          end

          test 'handles a *:* search' do
            get :index, params: { case_id: acase.id, snapshot_id: snapshot.id, q: '*:*' }

            assert_response :ok

            data = response.parsed_body

            assert_equal data['responseHeader']['params']['q'], '*:*'
            assert_equal data['response']['docs'].length, 2
          end

          test 'handles a missing query search' do
            get :index, params: { case_id: acase.id, snapshot_id: snapshot.id, q: 'missing query' }

            assert_response :ok

            data = response.parsed_body

            assert_equal data['responseHeader']['params']['q'], 'missing query'
            assert_equal data['response']['docs'].length, 0
          end
        end
      end
    end
  end
end
