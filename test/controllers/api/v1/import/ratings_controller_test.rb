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

        def with_import_error error
          original = RatingsImporter.instance_method(:import)
          RatingsImporter.define_method(:import) { raise error }
          yield
        ensure
          RatingsImporter.define_method(:import, original)
        end

        describe '#create' do
          test 'reports unexpected import errors without exposing details' do
            error = RuntimeError.new('secret database details')
            reported = []
            subscriber = Object.new
            subscriber.define_singleton_method(:report) { |exception, **| reported << exception }
            Rails.error.subscribe(subscriber)
            with_import_error(error) do
              post :create, params: { case_id: acase.id, ratings: [] }
            end
            assert_includes reported, error

            assert_response :bad_request
            assert_equal({ 'message' => 'Unable to import ratings. Please try again.' }, response.parsed_body)
          ensure
            Rails.error.unsubscribe(subscriber)
          end

          test 'does not swallow process-level exceptions' do
            [ Interrupt, NoMemoryError, SystemExit ].each do |error_class|
              with_import_error(error_class.new('stop')) do
                assert_raises(error_class) do
                  post :create, params: { case_id: acase.id, ratings: [] }
                end
              end
            end
          end

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
        describe '#create from RRE' do
          test 'preserves queries without relevant documents but omits empty document groups' do
            rre = { queries: [
              { placeholders: { '$query' => 'no documents' } },
              { placeholders: { '$query' => 'empty groups' }, relevant_documents: {} }
            ] }

            post :create, params: { case_id: acase.id, file_format: 'rre', rre_json: rre.to_json }

            assert_response :ok
            assert_empty acase.queries.find_by!(query_text: 'no documents').ratings
            assert_not acase.queries.exists?(query_text: 'empty groups')
          end

          test 'malformed RRE escapes the importer error response' do
            assert_raises(JSON::ParserError) do
              post :create, params: { case_id: acase.id, file_format: 'rre', rre_json: '{' }
            end
          end

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
        end

        describe '#create from LTR' do
          test 'imports LTR lines through the action including zero ratings' do
            post :create, params: {
              case_id:     acase.id,
              file_format: 'ltr',
              ltr_text:    "0 qid:2 # 9755 star trek\n\n3 qid:2 # 9756 star trek",
            }

            assert_response :ok
            imported_query = acase.queries.find_by!(query_text: 'star trek')
            assert_equal 0, imported_query.ratings.find_by!(doc_id: '9755').rating
            assert_equal 3, imported_query.ratings.find_by!(doc_id: '9756').rating
            assert_equal({ 'message' => 'Success!' }, response.parsed_body)
          end

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
        end
      end
    end
  end
end
