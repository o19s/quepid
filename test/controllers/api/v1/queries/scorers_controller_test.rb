# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    module Queries
      class ScorersControllerTest < ActionController::TestCase
        let(:user)    { users(:random) }
        let(:acase)   { cases(:queries_case) }
        let(:query)   { queries(:first_query) }
        let(:scorer)  { scorers(:query_scorer) }

        before do
          @controller = Api::V1::Queries::ScorersController.new

          login_user user
        end

        describe 'Fetches query scorer info' do
          test 'returns nil for scorer id & false for the enabled flag if no scorer is associated with the query' do
            get :show, params: { case_id: acase.id, query_id: query.id }

            assert_response :ok

            data = JSON.parse(response.body)

            assert_nil    data['scorerId']
            assert_equal  data['scorerEnbl'], false
          end

          test 'return the scorer id and true for the enabled flag' do
            query.scorer      = scorer
            query.scorer_enbl = true
            query.save

            get :show, params: { case_id: acase.id, query_id: query.id }

            assert_response :ok

            data = JSON.parse(response.body)

            assert_equal  data['scorerId'],   scorer.id
            assert_equal  data['scorerEnbl'], true
          end
        end

        describe 'Updates query scorer' do
          test 'returns a not found error if the scorer does not exist' do
            put :update, params: { case_id: acase.id, query_id: query.id, scorer_id: 'foo' }

            assert_response :not_found
          end

          test 'sets the query scorer and updates the enabled flag to true' do
            put :update, params: { case_id: acase.id, query_id: query.id, scorer_id: scorer.id }

            assert_response :ok

            data = JSON.parse(response.body)

            query.reload
            assert_equal  query.scorer_id, scorer.id

            assert_equal  data['scorerId'],   scorer.id
            assert_equal  data['scorerEnbl'], true
          end

          describe 'analytics' do
            test 'posts event' do
              expects_any_ga_event_call

              perform_enqueued_jobs do
                put :update, params: { case_id: acase.id, query_id: query.id, scorer_id: scorer.id }

                assert_response :ok
              end
            end
          end
        end

        describe 'Removes scorer from query' do
          test 'removes the query scorer and update the enabled flag to false' do
            delete :destroy, params: { case_id: acase.id, query_id: query.id }

            assert_response :ok

            data = JSON.parse(response.body)

            assert_nil    data['scorerId']
            assert_equal  data['scorerEnbl'], false
          end

          describe 'analytics' do
            test 'posts event' do
              expects_any_ga_event_call

              perform_enqueued_jobs do
                delete :destroy, params: { case_id: acase.id, query_id: query.id }

                assert_response :ok
              end
            end
          end
        end
      end
    end
  end
end
