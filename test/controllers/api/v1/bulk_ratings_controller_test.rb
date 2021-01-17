# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    class BulkRatingsControllerTest < ActionController::TestCase
      let(:user)  { users(:random) }
      let(:acase) { cases(:queries_case) }
      let(:query) { queries(:first_query) }

      before do
        @controller = Api::V1::BulkRatingsController.new

        login_user user
      end

      describe 'update' do
        test 'sets rating for all docs' do
          doc_ids = %w[x123z x456z]

          assert_difference 'query.ratings.count', 2 do
            put :update, params: { case_id: acase.id, query_id: query.id, doc_ids: doc_ids, rating: 5 }

            assert_response :no_content
          end
        end

        describe 'analytics' do
          test 'posts event' do
            expects_any_ga_event_call

            doc_ids = %w[x123z x456z]

            perform_enqueued_jobs do
              put :update, params: { case_id: acase.id, query_id: query.id, doc_ids: doc_ids, rating: 5 }

              assert_response :no_content
            end
          end
        end
      end

      describe 'Removes doc rating' do
        test 'deletes rating from query' do
          doc_id  = 'x123z'
          doc_ids = [ doc_id ]
          query.ratings.create(doc_id: doc_id, rating: 1)

          assert_difference 'query.ratings.count', -1 do
            delete :destroy, params: { case_id: acase.id, query_id: query.id, doc_ids: doc_ids }

            assert_response :no_content
          end
        end
      end

      describe 'analytics' do
        test 'posts event' do
          expects_any_ga_event_call

          doc_id  = 'x123z'
          doc_ids = [ doc_id ]
          query.ratings.create(doc_id: doc_id, rating: 1)

          perform_enqueued_jobs do
            delete :destroy, params: { case_id: acase.id, query_id: query.id, doc_ids: doc_ids }

            assert_response :no_content
          end
        end
      end
    end
  end
end
