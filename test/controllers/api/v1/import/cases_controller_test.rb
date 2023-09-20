# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    module Import
      class CasesControllerTest < ActionController::TestCase
        let(:user) { users(:random) }
        let(:acase) { cases(:queries_case) }

        before do
          @controller = Api::V1::Import::CasesController.new

          login_user user
        end

        describe '#create' do
          test 'alerts when a user assocated with a rating does not exist' do
            data = {
              case_name: 'test case',
              scorer:    acase.scorer.as_json(only: [ :name ]),
              try:       acase.tries.last.as_json,
              queries:   [
                {
                  arranged_at:       1,
                  arranged_next:     nil,
                  query_text:        'First Query',
                  threshold:         nil,
                  threshold_enabled: nil,
                  options:           nil,
                  notes:             nil,
                  information_need:  'I am the first query',
                  ratings:           [],
                },
                {
                  arranged_at:       2,
                  arranged_next:     nil,
                  query_text:        'Second Query',
                  threshold:         nil,
                  threshold_enabled: nil,
                  options:           nil,
                  notes:             nil,
                  information_need:  'I am the second query',
                  ratings:           [
                    {
                      doc_id:     'docb',
                      rating:     1.0,
                      user_email: 'fakeuser@fake.com',
                    },
                    {
                      doc_id: 'doca',
                      rating: 3.0,
                    }
                  ],
                }
              ],
            }

            post :create, params: { case: data, format: :json }

            assert_response :bad_request

            body = response.parsed_body

            assert_includes body['base'], "User with email 'fakeuser@fake.com' needs to be migrated over first."
            assert_nil Case.find_by(case_name: 'test case')
          end

          test 'alerts when a scorer associated with a case does not exist' do
            data = {
              case_name: 'test case',
              scorer:    {
                name: 'fake scorer',

              },
              try:       acase.tries.last.as_json,
              queries:   [],
            }

            post :create, params: { case: data, format: :json }

            assert_response :bad_request

            body = response.parsed_body

            assert_includes body['scorer'],
                            "Scorer with name 'fake scorer' needs to be migrated over first."
            assert_nil Case.find_by(case_name: 'test case')
          end

          test 'creates a new book' do
            data = {
              case_name: 'test case',
              scorer:    acase.scorer.as_json(only: [ :name ]),
              try:       acase.tries.last.as_json(only: [ :api_method, :custom_headers, :escape_query,
                                                          :search_url, :try_number ]),
              queries:   [
                {
                  arranged_at:      1,
                  arranged_next:    nil,
                  query_text:       'First Query',
                  threshold:        nil,
                  threshold_enbl:   nil,
                  options:          nil,
                  notes:            nil,
                  information_need: 'I am the first query',
                  ratings:          [],
                },
                {
                  arranged_at:      2,
                  arranged_next:    nil,
                  query_text:       'Second Query',
                  threshold:        nil,
                  threshold_enbl:   nil,
                  options:          nil,
                  notes:            nil,
                  information_need: 'I am the second query',
                  ratings:          [
                    {
                      doc_id:     'docb',
                      rating:     1.0,
                      user_email: 'random@example.com',
                    },
                    {
                      doc_id: 'doca',
                      rating: 3.0,
                    }
                  ],
                }
              ],
            }

            post :create, params: { case: data, format: :json }

            assert_response :created

            @case = Case.find_by(case_name: 'test case')

            assert_not_nil @case

            assert_equal 2, @case.queries.count
            assert_equal 2, @case.ratings.count
            assert_equal 1, @case.tries.count
          end
        end
      end
    end
  end
end
