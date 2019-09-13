# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    module Queries
      class RatingsControllerTest < ActionController::TestCase
        let(:user)  { users(:random) }
        let(:acase) { cases(:queries_case) }
        let(:query) { queries(:first_query) }

        before do
          @controller = Api::V1::Queries::RatingsController.new

          login_user user
        end

        describe 'Update query rating for doc' do
          test 'creates a new rating with TMDB id (issue 1001)' do
            doc_id = '7555'

            put :update, case_id: acase.id, query_id: query.id, doc_id: doc_id, rating: 4

            assert_response :ok

            data = JSON.parse(response.body)

            assert_equal data['rating'],    4
            assert_equal data['doc_id'],    doc_id
            assert_equal data['query_id'],  query.id

            count = query.ratings.where(doc_id: doc_id).count

            assert_equal count, 1
          end

          test "creates a new rating if it didn't already exist" do
            doc_id = 'x123z'

            put :update, case_id: acase.id, query_id: query.id, doc_id: doc_id, rating: 5

            assert_response :ok

            data = JSON.parse(response.body)

            assert_equal data['rating'],    5
            assert_equal data['doc_id'],    doc_id
            assert_equal data['query_id'],  query.id

            count = query.ratings.where(doc_id: doc_id).count

            assert_equal count, 1
          end

          test 'updates existing rating for doc' do
            doc_id = 'x123z'
            query.ratings.create(doc_id: doc_id, rating: 1)

            put :update, case_id: acase.id, query_id: query.id, doc_id: doc_id, rating: 5

            assert_response :ok

            data = JSON.parse(response.body)

            assert_equal data['rating'],    5
            assert_equal data['doc_id'],    doc_id
            assert_equal data['query_id'],  query.id

            count = query.ratings.where(doc_id: doc_id).count

            assert_equal count, 1
          end

          test "works with a url as the id" do
            doc_id     = 'https%3A%2F%2Fexample.com%2Frelative-path'
            encoded_id = Base64.strict_encode64(doc_id)

            assert_recognizes(
              {
                format:     :json,
                controller: 'api/v1/queries/ratings',
                action:     'update',
                case_id:    acase.id.to_s,
                query_id:   query.id.to_s,
                doc_id:     encoded_id,
              },
              path:   "/api/cases/#{acase.id}/queries/#{query.id}/ratings/#{encoded_id}",
              method: :put
            )

            put :update, case_id: acase.id, query_id: query.id, doc_id: encoded_id, rating: 5

            assert_response :ok

            data = JSON.parse(response.body)

            assert_equal data['rating'],    5
            assert_equal data['doc_id'],    doc_id
            assert_equal data['query_id'],  query.id

            count = query.ratings.where(doc_id: doc_id).count

            assert_equal count, 1

            doc_id     = 'https://example.com/relative-path2'
            encoded_id = Base64.strict_encode64(doc_id)

            assert_recognizes(
              {
                format:     :json,
                controller: 'api/v1/queries/ratings',
                action:     'update',
                case_id:    acase.id.to_s,
                query_id:   query.id.to_s,
                doc_id:     encoded_id,
              },
              path:   "/api/cases/#{acase.id}/queries/#{query.id}/ratings/#{encoded_id}",
              method: :put
            )

            put :update, case_id: acase.id, query_id: query.id, doc_id: encoded_id, rating: 6

            assert_response :ok

            data = JSON.parse(response.body)

            assert_equal data['rating'],    6
            assert_equal data['doc_id'],    doc_id
            assert_equal data['query_id'],  query.id

            count = query.ratings.where(doc_id: doc_id).count

            assert_equal count, 1
          end

          test "works with a document id that contains a period" do
            doc_id = 'mydoc.pdf'

            put :update, case_id: acase.id, query_id: query.id, doc_id: doc_id, rating: 5

            assert_response :ok

            data = JSON.parse(response.body)

            assert_equal data['rating'],    5
            assert_equal data['doc_id'],    doc_id
            assert_equal data['query_id'],  query.id

            count = query.ratings.where(doc_id: doc_id).count

            assert_equal count, 1
          end

          describe "analytics" do
            test 'posts event' do
              expects_any_ga_event_call

              doc_id = 'x123z'

              perform_enqueued_jobs do
                put :update, case_id: acase.id, query_id: query.id, doc_id: doc_id, rating: 5

                assert_response :ok
              end
            end
          end
        end

        describe 'Removes doc rating' do
          test 'deletes rating from query' do
            doc_id = 'x123z'
            query.ratings.create(doc_id: doc_id, rating: 1)

            delete :destroy, case_id: acase.id, query_id: query.id, doc_id: doc_id

            assert_response :no_content

            rating = query.ratings.where(doc_id: doc_id).first

            assert_nil rating
          end

          describe 'analytics' do
            test 'posts event' do
              expects_any_ga_event_call

              doc_id = 'x123z'
              query.ratings.create(doc_id: doc_id, rating: 1)

              perform_enqueued_jobs do
                delete :destroy, case_id: acase.id, query_id: query.id, doc_id: doc_id

                assert_response :no_content
              end
            end
          end
        end
      end
    end
  end
end
