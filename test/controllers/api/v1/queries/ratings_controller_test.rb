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
            rating = {
              doc_id: doc_id,
              rating: 4,
            }

            put :update, params: { case_id: acase.id, query_id: query.id, rating: rating }
            assert_response :ok

            data = response.parsed_body

            assert_equal 4, data['rating']
            assert_equal data['doc_id'],    doc_id
            assert_equal data['query_id'],  query.id

            count = query.ratings.where(doc_id: doc_id).count

            assert_equal 1, count
          end

          test "creates a new rating if it didn't already exist" do
            doc_id = 'x123z'

            rating = {
              doc_id: doc_id,
              rating: 5,
            }

            put :update, params: { case_id: acase.id, query_id: query.id, rating: rating }
            assert_response :ok

            data = response.parsed_body

            assert_equal 5, data['rating']
            assert_equal data['doc_id'],    doc_id
            assert_equal data['query_id'],  query.id

            count = query.ratings.where(doc_id: doc_id).count

            assert_equal 1, count
          end

          test 'updates existing rating for doc' do
            doc_id = 'x123z'
            query.ratings.create(doc_id: doc_id, rating: 1)

            rating = {
              doc_id: doc_id,
              rating: 5,
            }

            put :update, params: { case_id: acase.id, query_id: query.id, rating: rating }
            assert_response :ok

            data = response.parsed_body

            assert_equal 5, data['rating']
            assert_equal data['doc_id'],    doc_id
            assert_equal data['query_id'],  query.id

            count = query.ratings.where(doc_id: doc_id).count

            assert_equal 1, count
          end

          test 'works with a url as the id' do
            doc_id = 'https%3A%2F%2Fexample.com%2Frelative-path'
            rating = {
              doc_id: doc_id,
              rating: 5,
            }

            assert_recognizes(
              {
                format:     :json,
                controller: 'api/v1/queries/ratings',
                action:     'update',
                case_id:    acase.id.to_s,
                query_id:   query.id.to_s,
              },
              path:   "/api/cases/#{acase.id}/queries/#{query.id}/ratings",
              method: :put
            )

            put :update, params: { case_id: acase.id, query_id: query.id, rating: rating }
            assert_response :ok

            data = response.parsed_body

            assert_equal 5, data['rating']
            assert_equal data['doc_id'],    doc_id
            assert_equal data['query_id'],  query.id

            count = query.ratings.where(doc_id: doc_id).count

            assert_equal 1, count

            doc_id = 'https://example.com/relative-path2'
            rating = {
              doc_id: doc_id,
              rating: 6,
            }

            assert_recognizes(
              {
                format:     :json,
                controller: 'api/v1/queries/ratings',
                action:     'update',
                case_id:    acase.id.to_s,
                query_id:   query.id.to_s,
              },
              path:   "/api/cases/#{acase.id}/queries/#{query.id}/ratings",
              method: :put
            )

            put :update, params: { case_id: acase.id, query_id: query.id, rating: rating }
            assert_response :ok

            data = response.parsed_body

            assert_equal 6, data['rating']
            assert_equal data['doc_id'],    doc_id
            assert_equal data['query_id'],  query.id

            count = query.ratings.where(doc_id: doc_id).count

            assert_equal 1, count

            # test where we have https but it's all dashes, no / or . character.
            doc_id = 'https-example-com-relative-path2'
            rating = {
              doc_id: doc_id,
              rating: 6,
            }

            assert_recognizes(
              {
                format:     :json,
                controller: 'api/v1/queries/ratings',
                action:     'update',
                case_id:    acase.id.to_s,
                query_id:   query.id.to_s,
              },
              path:   "/api/cases/#{acase.id}/queries/#{query.id}/ratings",
              method: :put
            )

            put :update, params: { case_id: acase.id, query_id: query.id, rating: rating }
            assert_response :ok

            data = response.parsed_body

            assert_equal 6, data['rating']
            assert_equal data['doc_id'],    doc_id
            assert_equal data['query_id'],  query.id

            count = query.ratings.where(doc_id: doc_id).count

            assert_equal 1, count
          end

          test 'works with a document id that contains a period' do
            doc_id = 'mydoc.pdf'
            rating = {
              doc_id: doc_id,
              rating: 5,
            }

            put :update, params: { case_id: acase.id, query_id: query.id, rating: rating }
            assert_response :ok

            data = response.parsed_body

            assert_equal 5, data['rating']
            assert_equal data['doc_id'],    doc_id
            assert_equal data['query_id'],  query.id

            count = query.ratings.where(doc_id: doc_id).count

            assert_equal 1, count
          end

          describe 'analytics' do
            test 'posts event' do
              expects_any_ga_event_call

              doc_id = 'x123z'
              rating = {
                doc_id: doc_id,
                rating: 5,
              }

              perform_enqueued_jobs do
                put :update, params: { case_id: acase.id, query_id: query.id, rating: rating }
                assert_response :ok
              end
            end
          end

          test 'returns Turbo Stream when Accept includes turbo-stream' do
            doc_id = 'x123z'
            rating = { doc_id: doc_id, rating: 3 }

            put :update,
                params: { case_id: acase.id, query_id: query.id, rating: rating },
                format: :turbo_stream

            assert_response :ok
            assert_equal 'text/vnd.turbo-stream.html', response.media_type
            assert_includes response.body, "rating-badge-#{doc_id}"
            assert_includes response.body, 'turbo-stream'
            assert_includes response.body, '3'
          end
        end

        describe 'Removes doc rating' do
          test 'deletes rating from query' do
            doc_id = 'x123z'
            rating = {
              doc_id: doc_id,
            }
            query.ratings.create(doc_id: doc_id, rating: 1)

            delete :destroy, params: { case_id: acase.id, query_id: query.id, rating: rating }
            assert_response :no_content

            rating = query.ratings.where(doc_id: doc_id).first

            assert_nil rating
          end

          describe 'analytics' do
            test 'posts event' do
              expects_any_ga_event_call

              doc_id = 'x123z'
              rating = {
                doc_id: doc_id,
              }
              query.ratings.create(doc_id: doc_id, rating: 1)

              perform_enqueued_jobs do
                delete :destroy, params: { case_id: acase.id, query_id: query.id, rating: rating }
                assert_response :no_content
              end
            end
          end

          test 'returns Turbo Stream when Accept includes turbo-stream' do
            doc_id = 'x123z'
            rating = { doc_id: doc_id }
            query.ratings.create(doc_id: doc_id, rating: 1)

            delete :destroy,
                   params: { case_id: acase.id, query_id: query.id, rating: rating },
                   format: :turbo_stream

            assert_response :ok
            assert_equal 'text/vnd.turbo-stream.html', response.media_type
            assert_includes response.body, "rating-badge-#{doc_id}"
            assert_includes response.body, 'turbo-stream'
          end
        end
      end
    end
  end
end
