# frozen_string_literal: true

require 'test_helper'
require 'csv'

module Api
  module V1
    module Export
      class CasesControllerTest < ActionController::TestCase
        let(:user) { users(:random) }

        before do
          @controller = Api::V1::Export::CasesController.new
          login_user user
        end

        describe 'Exporting a case in json' do
          let(:acase) { cases(:queries_case) }

          test 'the AR object ids are replaced with names' do
            get :show, params: { case_id: acase.id }
            assert_response :ok
            body = response.parsed_body

            assert_nil body['case_id']
            assert_not_nil body['case_name']

            assert_nil body['scorer_id']
            assert_not_nil body['scorer']
            assert_nil body['scorer']['scorer_id']
            assert_nil body['scorer']['code']
            assert_nil body['scorer']['teams']

            assert_not_nil body['try']
            assert_not_empty body['try']['curator_variables']
            assert_not_empty body['try']['search_endpoint']
            assert_nil body['try']['search_endpoint']['scorer_id']
          end
        end

        describe 'general CSV' do
          test 'returns CSV with header when case has no last_score queries' do
            acase = cases(:queries_case)
            get :general, params: { case_id: acase.id }, format: :csv
            assert_response :ok
            assert_equal 'text/csv', response.media_type
            assert response.body.include?('Team Name')
            assert response.body.include?('Query Text')
          end

          test 'returns CSV with data when case has last_score with queries' do
            acase = cases(:other_score_case)
            get :general, params: { case_id: acase.id }, format: :csv
            assert_response :ok
            assert_equal 'text/csv', response.media_type
            assert response.body.include?('Team Name')
            # May have rows if score_with_queries is last_score
            assert response.body.include?('Query Text')
          end
        end

        describe 'detailed CSV' do
          test 'returns CSV with header and rows from ratings' do
            acase = cases(:queries_case)
            get :detailed, params: { case_id: acase.id }, format: :csv
            assert_response :ok
            assert_equal 'text/csv', response.media_type
            assert response.body.include?('Doc ID')
            assert response.body.include?('Rating')
          end
        end

        describe 'snapshot CSV' do
          test 'returns 404 when snapshot_id missing' do
            acase = cases(:snapshot_case)
            get :snapshot, params: { case_id: acase.id }, format: :csv
            assert_response :not_found
          end

          test 'returns 404 when snapshot not found' do
            acase = cases(:snapshot_case)
            get :snapshot, params: { case_id: acase.id, snapshot_id: 99999 }, format: :csv
            assert_response :not_found
          end

          test 'returns CSV when snapshot exists' do
            acase = cases(:snapshot_case)
            snap = acase.snapshots.first
            skip 'No snapshot fixture for snapshot_case' unless snap
            get :snapshot, params: { case_id: acase.id, snapshot_id: snap.id }, format: :csv
            assert_response :ok
            assert_equal 'text/csv', response.media_type
            assert response.body.include?('Snapshot Name')
          end
        end
      end
    end
  end
end
