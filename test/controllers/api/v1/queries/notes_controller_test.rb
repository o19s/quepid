# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    module Queries
      class NotesControllerTest < ActionController::TestCase
        let(:user)  { users(:random) }
        let(:acase) { cases(:queries_case) }
        let(:query) { queries(:first_query) }

        before do
          @controller = Api::V1::Queries::NotesController.new

          login_user user
        end

        describe 'Fetches query notes' do
          test 'returns nil if the query has no notes' do
            get :show, params: { case_id: acase.id, query_id: query.id }

            assert_response :ok

            data = JSON.parse(response.body)

            assert_nil data['notes']
          end

          test "return the query's notes" do
            note = 'Some awesome note'
            query.notes = note
            query.save

            get :show, params: { case_id: acase.id, query_id: query.id }

            assert_response :ok

            data = JSON.parse(response.body)

            assert_equal data['notes'], note
          end
        end

        describe "Updates query's notes" do
          test 'sets the new query notes successfully' do
            note = 'An even awesomer note'
            put :update, params: { case_id: acase.id, query_id: query.id, query: { notes: note } }

            assert_response :ok

            data = JSON.parse(response.body)

            query.reload
            assert_equal  query.notes,    note
            assert_equal  data['notes'],  note
          end

          describe 'analytics' do
            test 'posts event' do
              expects_any_ga_event_call

              note = 'An even awesomer note'

              perform_enqueued_jobs do
                put :update, params: { case_id: acase.id, query_id: query.id, query: { notes: note } }

                assert_response :ok
              end
            end
          end
        end
      end
    end
  end
end
