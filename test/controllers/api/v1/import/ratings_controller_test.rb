# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    module Import
      class RatingsControllerTest < ActionController::TestCase
        let(:user)  { users(:random) }
        let(:acase) { cases(:import_ratings_case) }
        let(:query) { queries(:import_ratings_query) }

        before do
          @controller = Api::V1::Import::RatingsController.new

          login_user user
        end

        describe '#create' do
          test 'creates new queries when needed' do
            data = {
              case_id: acase.id,
              ratings: [
                { query_text: 'dog', doc_id: '123', rating: 1 },
                { query_text: 'dog', doc_id: '234', rating: 2 },
                { query_text: 'dog', doc_id: '456', rating: 3 }
              ],
            }
            assert_difference 'acase.queries.count' do
              post :create, params: data

              assert_response :ok
            end
          end

          test 'does not create new queries when already present' do
            data = {
              case_id: acase.id,
              ratings: [
                { query_text: query.query_text, doc_id: '123', rating: 1 },
                { query_text: query.query_text, doc_id: '234', rating: 2 },
                { query_text: query.query_text, doc_id: '456', rating: 3 }
              ],
            }
            assert_no_difference 'acase.queries.count' do
              post :create, params: data

              assert_response :ok
            end
          end

          test 'creates new ratings when needed' do
            data = {
              case_id: acase.id,
              ratings: [
                { query_text: 'dog', doc_id: '123', rating: 1 },
                { query_text: 'dog', doc_id: '234', rating: 2 },
                { query_text: 'dog', doc_id: '456', rating: 3 }
              ],
            }
            assert_difference 'Rating.count', 3 do
              post :create, params: data

              assert_response :ok
            end
          end

          test 'updates existing ratings' do
            data = {
              case_id: acase.id,
              ratings: [
                { query_text: query.query_text, doc_id: '123', rating: 1 },
                { query_text: query.query_text, doc_id: '234', rating: 2 },
                { query_text: query.query_text, doc_id: '456', rating: 3 }
              ],
            }

            rating = Rating.where(query_id: query.id, doc_id: '123').first

            assert_not_equal rating.rating, 1

            assert_no_difference 'Rating.count' do
              post :create, params: data

              assert_response :ok

              rating.reload

              assert_equal 1, rating.rating
            end
          end

          test 'clears existing ratings if flag is set to true' do
            data = {
              case_id:       acase.id,
              clear_queries: true,
              ratings:       [
                { query_text: query.query_text, doc_id: '123', rating: 1 },
                { query_text: query.query_text, doc_id: '234', rating: 2 }
              ],
            }

            assert_difference 'Rating.count', -1 do
              post :create, params: data

              assert_response :ok
            end
          end

          test 'deletes unused queries if flag is set to true' do
            data = {
              case_id:       acase.id,
              clear_queries: true,
              ratings:       [
                { query_text: 'dog', doc_id: '123', rating: 1 },
                { query_text: 'dog', doc_id: '234', rating: 2 },
                { query_text: 'dog', doc_id: '456', rating: 3 }
              ],
            }
            assert_not query.destroyed?
            assert_no_difference 'acase.queries.count' do
              post :create, params: data

              assert_response :ok
            end
            assert_not Query.exists?(query.id)
          end
        end
        test 'hash format with absent ratings does not raise' do
          data = {
            case_id:      acase.id,
            file_format:  'hash',
            clear_queries: false,
          }
          post :create, params: data
          assert_response :ok
        end

        test 'accepts file_format csv as hash (client parses CSV to ratings)' do
          data = {
            case_id:       acase.id,
            file_format:  'csv',
            clear_queries: false,
            ratings:      [
              { query_text: 'dog', doc_id: '123', rating: 1 },
              { query_text: 'dog', doc_id: '234', rating: 2 }
            ],
          }
          assert_difference 'Rating.count', 2 do
            post :create, params: data
            assert_response :ok
          end
        end

        describe '#create from RRE' do
          test 'creates new queries from rre format mapped to hash format' do
            mock_rre_json = File.read('./test/controllers/api/v1/import/mock_rre_json.json')
            data = {
              case_id:       acase.id,
              clear_queries: true,
              rre_json:      mock_rre_json,
              file_format:   'rre',
            }

            assert_difference 'acase.queries.count' do
              post :create, params: data
              assert_response :ok
            end
          end

          test 'handles RRE with valid JSON but no queries key' do
            data = {
              case_id:       acase.id,
              clear_queries: true,
              rre_json:      '{"index":"test"}', # no queries key
              file_format:   'rre',
            }
            post :create, params: data
            assert_response :ok
          end

          test 'returns 400 for invalid RRE JSON with clear message' do
            data = {
              case_id:       acase.id,
              clear_queries: true,
              rre_json:      '{invalid json',
              file_format:   'rre',
            }
            post :create, params: data
            assert_response :bad_request
            json = JSON.parse(response.body)
            assert_equal "Invalid RRE JSON format", json["message"]
          end

          test 'skips RRE queries with missing placeholders or $query' do
            data = {
              case_id:       acase.id,
              clear_queries: true,
              rre_json:      '{"queries":[{"placeholders":{"$query":"valid"},"relevant_documents":{"1":["123"]}},{"relevant_documents":{"1":["456"]}}]}',
              file_format:   'rre',
            }
            # Only the first query has placeholders.$query; second is skipped
            post :create, params: data
            assert_response :ok
            acase.reload
            assert_equal 1, acase.ratings.count, 'Should have exactly 1 rating from the valid query'
          end
        end

        describe '#create from LTR' do
          test 'convert a ltr line into a rating' do
            rating = @controller.rating_from_ltr_line('0    qid:2 #    9755 "star trek"')
            assert_equal '0', rating[:rating]
            assert_equal '9755', rating[:doc_id]
            assert_equal '"star trek"', rating[:query_text]

            rating = @controller.rating_from_ltr_line(' 0    qid:2 #    9755 star trek')
            assert_equal '0', rating[:rating]
            assert_equal '9755', rating[:doc_id]
            assert_equal 'star trek', rating[:query_text]
          end

          test 'returns nil for malformed LTR lines' do
            assert_nil @controller.rating_from_ltr_line('nospace')
            assert_nil @controller.rating_from_ltr_line('0 qid:1 nohash 9755 query')
            assert_nil @controller.rating_from_ltr_line('0 qid:1 # 9755')
          end

          test 'skips invalid LTR lines when importing' do
            data = {
              case_id:      acase.id,
              file_format:  'ltr',
              ltr_text:     "0 qid:1 # 123 valid query\nbadline\n1 qid:2 # 456 another query",
            }
            assert_difference 'Rating.count', 2 do
              post :create, params: data
              assert_response :ok
            end
          end
        end
      end
    end
  end
end
