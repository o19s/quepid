# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    class QueriesControllerTest < ActionController::TestCase
      let(:user) { users(:random) }

      before do
        @controller = Api::V1::QueriesController.new

        login_user user
      end

      describe 'Adds new query' do
        let(:acase) { cases(:queries_case) }

        test 'requires query text' do
          post :create, params: { case_id: acase.id, query: { query_text: nil } }

          assert_response :bad_request

          assert_includes response.parsed_body['query_text'], "can't be blank"
        end

        test 'to the end of the query list if no position is provided' do
          query_text = 'New Query'
          post :create, params: { case_id: acase.id, query: { query_text: query_text } }

          assert_response :ok

          query_response = response.parsed_body['query']

          assert_not_nil  query_response['query_id']
          assert_equal    query_response['query_text'], query_text

          query = acase.queries.first

          assert_equal query.id,          query_response['query_id']
          assert_equal query.query_text,  query_text
        end

        test 'return the new display order of the queries' do
          query_text = 'New Query'
          post :create, params: { case_id: acase.id, query: { query_text: query_text } }

          assert_response :ok

          display_order = response.parsed_body['display_order']

          assert_not_nil display_order
          assert_instance_of Array, display_order
        end

        test 'at the proper position when one is provided' do
          query_text  = 'New Query'
          position    = 2
          post :create, params: { case_id: acase.id, query: { query_text: query_text }, position: 2 }

          assert_response :ok

          query_response = response.parsed_body['query']

          assert_not_nil  query_response['query_id']
          assert_equal    query_response['query_text'], query_text

          acase.reload
          query = acase.queries[position]

          assert_equal query.id,          query_response['query_id']
          assert_equal query.query_text,  query_text
        end

        test 'with special characters in name' do
          query_text = 'New Query 会议'
          post :create, params: { case_id: acase.id, query: { query_text: query_text } }

          assert_response :ok

          query_response = response.parsed_body['query']

          assert_not_nil  query_response['query_id']
          assert_equal    query_response['query_text'], query_text
        end

        test 'with emoji' do
          query_text = 'kfc 🍟➕🍔➕🍗'
          post :create, params: { case_id: acase.id, query: { query_text: query_text } }

          assert_response :ok

          query_response = response.parsed_body['query']

          assert_not_nil  query_response['query_id']
          assert_equal    query_response['query_text'], query_text
        end

        test 'handles when query already exists' do
          query_text = 'New Query'
          post :create, params: { case_id: acase.id, query: { query_text: query_text } }

          assert_response :ok

          query_response = response.parsed_body['query']

          assert_not_nil  query_response['query_id']
          assert_equal    query_response['query_text'], query_text

          count = acase.queries.count

          query_text = 'New Query'
          post :create, params: { case_id: acase.id, query: { query_text: query_text } }

          assert_response :ok

          acase.reload
          new_count = acase.queries.count

          assert_equal count, new_count
        end

        test 'strips whitespace from query text' do
          query_text = 'New Query '
          post :create, params: { case_id: acase.id, query: { query_text: query_text } }

          assert_response :ok

          query_response = response.parsed_body['query']

          assert_not_nil  query_response['query_id']
          assert_equal    query_response['query_text'], query_text.strip

          count = acase.queries.count

          query_text = ' New Query'
          post :create, params: { case_id: acase.id, query: { query_text: query_text } }

          assert_response :ok

          acase.reload
          new_count = acase.queries.count

          assert_equal count, new_count
        end

        test 'accepts a different variation of the same query text' do
          query_text = 'dog'

          assert_difference 'acase.queries.count' do
            post :create, params: { case_id: acase.id, query: { query_text: query_text } }

            assert_response :ok

            query_response = response.parsed_body['query']

            assert_equal query_response['query_text'], query_text
          end

          query_text = 'Dog'

          assert_difference 'acase.queries.count' do
            post :create, params: { case_id: acase.id, query: { query_text: query_text } }

            assert_response :ok

            query_response = response.parsed_body['query']

            assert_equal query_response['query_text'], query_text
          end

          query_text = 'DoG'

          assert_difference 'acase.queries.count' do
            post :create, params: { case_id: acase.id, query: { query_text: query_text } }

            assert_response :ok

            query_response = response.parsed_body['query']

            assert_equal query_response['query_text'], query_text
          end

          query_text = 'dOg'

          assert_difference 'acase.queries.count' do
            post :create, params: { case_id: acase.id, query: { query_text: query_text } }

            assert_response :ok

            query_response = response.parsed_body['query']

            assert_equal query_response['query_text'], query_text
          end
        end

        describe 'analytics' do
          test 'posts event' do
            expects_any_ga_event_call

            query_text = 'New Query'

            perform_enqueued_jobs do
              post :create, params: { case_id: acase.id, query: { query_text: query_text } }

              assert_response :ok
            end
          end
        end
      end

      describe 'Fetches case queries' do
        let(:acase) { cases(:queries_case) }

        test 'returns case queries in order' do
          get :index, params: { case_id: acase.id }

          assert_response :ok

          queries = response.parsed_body['queries']

          assert_equal 1, queries[0]['arranged_at']
          assert_equal 2, queries[1]['arranged_at']
          assert_equal 3, queries[2]['arranged_at']
        end
      end

      describe 'Deletes query' do
        let(:acase)       { cases(:queries_case) }
        let(:query)       { queries(:first_query) }
        let(:other_query) { queries(:second_query) }

        test "removes query from case queries array and updates other queries' position" do
          assert_difference 'acase.queries.count', -1 do
            delete :destroy, params: { case_id: acase.id, id: query.id }

            assert_response :no_content

            other_query.reload
            assert_equal 0, other_query.arranged_at
          end
        end

        test 'successfully deletes queries with ratings' do
          query.ratings.create doc_id: 'foo', rating: 1

          assert_difference 'acase.queries.count', -1 do
            delete :destroy, params: { case_id: acase.id, id: query.id }

            assert_response :no_content
          end
        end

        test 'returns a not found error if query does not exist' do
          delete :destroy, params: { case_id: acase.id, id: 'foo' }

          assert_response :not_found
        end

        describe 'analytics' do
          test 'posts event' do
            expects_any_ga_event_call

            perform_enqueued_jobs do
              delete :destroy, params: { case_id: acase.id, id: query.id }

              assert_response :no_content
            end
          end
        end
      end

      describe 'Moves query to another case' do
        let(:original_case) { cases(:queries_case) }
        let(:other_case)    { cases(:move_query_to_me) }
        let(:query)         { queries(:first_query) }

        test 'returns a not found error if other case does not exist' do
          patch :update, params: { case_id: original_case.id, id: query.id, other_case_id: 'foo' }

          assert_response :not_found
        end

        test 'removes query from original case and reorders case queries' do
          assert_difference 'original_case.queries.count', -1 do
            patch :update, params: { case_id: original_case.id, id: query.id, other_case_id: other_case.id }

            assert_response :ok

            query.reload
            original_case.reload

            assert_not_equal  query.case_id, original_case.id
            assert_equal      query.case_id, other_case.id
            assert_equal      0, query.arranged_at
            assert_not_includes original_case.queries, query

            new_first_query = original_case.queries.first

            assert_not_equal  new_first_query, query
            assert_equal      0, new_first_query.arranged_at
          end
        end

        test 'adds query to the other case at the top of the queries list' do
          patch :update, params: { case_id: original_case.id, id: query.id, other_case_id: other_case.id }

          assert_response :ok

          query.reload

          assert_equal      query.case_id, other_case.id
          assert_equal      0, query.arranged_at
        end

        describe 'analytics' do
          test 'posts event' do
            expects_any_ga_event_call

            perform_enqueued_jobs do
              patch :update, params: { case_id: original_case.id, id: query.id, other_case_id: other_case.id }

              assert_response :ok
            end
          end
        end
      end
    end
  end
end
