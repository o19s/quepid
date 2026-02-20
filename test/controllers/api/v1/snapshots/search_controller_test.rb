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

          test 'handles a term lookup for docs as if Solr' do
            query_string = 'id:('
            snapshot.snapshot_docs.each do |doc|
              query_string += "#{doc.doc_id} OR "
            end
            query_string = query_string[0...-4]
            query_string += ')'
            solr_query_params = {
              q:       query_string,
              defType: 'lucene',
              rows:    snapshot.snapshot_docs.count,
              fl:      snapshot.case.tries.first.field_spec,
              wt:      'json',
              hl:      false,

            }

            params = { case_id: acase.id, snapshot_id: snapshot.id }
            params   = params.merge(solr_query_params)

            get :index, params: params

            assert_response :ok

            data = response.parsed_body

            assert_equal query_string, data['responseHeader']['params']['q']
            assert_equal snapshot.snapshot_docs.count, data['response']['docs'].length
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

          test 'coerces invalid rows/start to 0 and returns empty docs' do
            snapshot_query = snapshot.snapshot_queries.first
            query_text = snapshot_query.query.query_text

            get :index, params: {
              case_id: acase.id, snapshot_id: snapshot.id, q: query_text,
              rows: 'abc', start: 'xyz'
            }

            assert_response :ok

            data = response.parsed_body
            # Invalid rows/start coerce to 0; pagination yields empty slice
            assert_equal 2, data['response']['numFound']
            assert_equal 0, data['response']['docs'].length
          end

          test 'deals with pagination' do
            snapshot_query = snapshot.snapshot_queries.first
            query_text = snapshot_query.query.query_text
            solr_params = {
              q:     query_text,
              rows:  1,
              start: 1,
            }
            params = {
              case_id: acase.id, snapshot_id: snapshot.id
            }
            params = params.merge(solr_params)

            get :index, params: params

            assert_response :ok

            data = response.parsed_body

            assert_equal query_text, data['responseHeader']['params']['q']
            assert_equal 2, data['response']['numFound']
            assert_equal solr_params[:rows], data['response']['docs'].length

            expected_params = solr_params.stringify_keys.transform_values(&:to_s)
            actual_params = data['responseHeader']['params'].transform_values(&:to_s)
            assert_equal expected_params, actual_params
          end
        end

        describe 'handles edge cases' do
          let(:acase)     { cases(:snapshot_case) }
          let(:snapshot)  { snapshots(:a_snapshot) }

          test 'replies with message when no parameters' do
            assert_raises(ActionController::ParameterMissing) do
              get :index, params: { case_id: acase.id, snapshot_id: snapshot.id }
            end
          end

          test 'handles a ? character in the query' do
            # the front end app converts a ? into a \? when sending the request.
            get :index, params: { case_id: acase.id, snapshot_id: snapshot.id, q: 'can you compare tesla to ford\?' }

            assert_response :ok

            data = response.parsed_body

            assert_equal 'can you compare tesla to ford?', data['responseHeader']['params']['q']
          end
        end
      end
    end
  end
end
