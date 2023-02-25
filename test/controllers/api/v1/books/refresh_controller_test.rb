# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    module Books
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
              assert_difference 'case_without_ratings.ratings.count', 2 do
                put :update, params: { case_id: case_without_ratings.id, book_id: book.id }

                assert_response :success
                body = response.parsed_body
                assert_equal 1, body['queries_created']
                assert_equal 2, body['ratings_created']
              end
            end
          end
        end

        describe 'refresh a case with existing ratings' do
          it 'creates all the ratings needed' do
            assert_difference 'case_with_ratings.queries.count', 1 do
              assert_difference 'case_with_ratings.ratings.count', 2 do
                put :update, params: { case_id: case_with_ratings.id, book_id: book.id }

                assert_response :success
                body = response.parsed_body
                assert_equal 1, body['queries_created']
                assert_equal 2, body['ratings_created']
              end
            end

            # second time around, shouldn't be any changes
            assert_difference 'case_with_ratings.queries.count', 0 do
              assert_difference 'case_with_ratings.ratings.count', 0 do
                put :update, params: { case_id: case_with_ratings.id, book_id: book.id }

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
