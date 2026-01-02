# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    module Books
      # These tests are copied over into ratings_manager_test.rb and should
      # be simplified to focus on the interaction of the control, not what
      # the ratings_manager does.
      class RefreshControllerTest < ActionController::TestCase
        let(:user)                  { users(:random_1) }
        let(:case_with_ratings)     { cases(:random_case) }
        let(:case_without_ratings)  { cases(:random_case_1) }
        let(:book)                  { books(:james_bond_movies) }

        before do
          @controller = Api::V1::Books::RefreshController.new

          login_user user
        end

        describe 'refresh a case with no ratings' do
          it 'creates all the ratings needed' do
            assert_difference 'case_without_ratings.queries.count', 1 do
              assert_difference 'case_without_ratings.ratings.count', 3 do
                put :update,
                    params: { case_id: case_without_ratings.id, book_id: book.id, create_missing_queries: true }

                assert_response :success

                body = response.parsed_body
                assert_equal 1, body['queries_created']
                assert_equal 3, body['ratings_created']
                assert_not body['process_in_background']
              end
            end
          end

          it 'handles unrated docs' do
            # clear out ratings and mark as unrateable instead.
            book.judgements.each do |judgement|
              judgement.rating = nil
              judgement.unrateable = true
              judgement.save!
            end

            assert_difference 'case_without_ratings.queries.count', 0 do
              assert_difference 'case_without_ratings.ratings.count', 0 do
                put :update, params: { case_id: case_without_ratings.id, book_id: book.id }

                assert_response :success

                body = response.parsed_body
                assert_equal 0, body['queries_created']
                assert_equal 0, body['ratings_created']
              end
            end
          end

          it 'handles a background job' do
            assert_difference 'case_without_ratings.queries.count', 1 do
              assert_difference 'case_without_ratings.ratings.count', 3 do
                perform_enqueued_jobs do
                  put :update,
                      params: { case_id: case_without_ratings.id, book_id: book.id, create_missing_queries: true, process_in_background: true }

                  assert_response :success

                  body = response.parsed_body

                  # process_in_background: true means we get don't get this information back.
                  assert_equal 0, body['queries_created']
                  assert_equal 0, body['ratings_created']
                  assert body['process_in_background']
                end
              end
            end
          end
        end

        describe 'refresh a case with existing ratings' do
          it 'creates all the ratings and queries needed' do
            assert_difference 'case_with_ratings.queries.count', 1 do
              assert_difference 'case_with_ratings.ratings.count', 3 do
                put :update, params: { case_id: case_with_ratings.id, book_id: book.id, create_missing_queries: true, process_in_background: false }

                assert_response :success
                body = response.parsed_body
                assert_equal 1, body['queries_created']
                assert_equal 3, body['ratings_created']
              end
            end

            # second time around, shouldn't be any changes
            assert_difference 'case_with_ratings.queries.count', 0 do
              assert_difference 'case_with_ratings.ratings.count', 0 do
                put :update, params: { case_id: case_with_ratings.id, book_id: book.id, process_in_background: false }

                assert_response :success
                body = response.parsed_body
                assert_equal 0, body['queries_created']
                assert_equal 0, body['ratings_created']
              end
            end
          end
        end
      end
    end
  end
end
