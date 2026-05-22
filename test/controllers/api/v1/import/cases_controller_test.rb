# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    module Import
      class CasesControllerTest < ActionController::TestCase
        let(:user) { users(:random) }
        let(:acase) { cases(:queries_case) }
        let(:search_endpoint) { search_endpoints(:one) }

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
                  arranged_at:      1,
                  arranged_next:    nil,
                  query_text:       'First Query',
                  options:          nil,
                  notes:            nil,
                  information_need: 'I am the first query',
                  ratings:          [],
                },
                {
                  arranged_at:      2,
                  arranged_next:    nil,
                  query_text:       'Second Query',
                  options:          nil,
                  notes:            nil,
                  information_need: 'I am the second query',
                  ratings:          [
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

          test 'overrides the existing owner of a case and assigns to the importer' do
            data = {
              case_name:   'test case',
              owner_email: 'fakeowner@fake.com',
              scorer:      acase.scorer.as_json(only: [ :name ]),
              try:         acase.tries.last.as_json.merge(
                search_endpoint: search_endpoint.as_json(except: [ :id, :owner_id, :created_at, :updated_at ])
              ),
              queries:     [],
            }

            post :create, params: { case: data, format: :json }

            assert_response :created

            kase = Case.find_by(case_name: 'test case')
            assert_not_nil kase
            kase.owner = user
          end

          test 'returns bad request when search endpoint fails validation on import' do
            with_require_proxy_with_basic_auth(true) do
              data = {
                case_name: 'invalid endpoint case',
                scorer:    acase.scorer.as_json(only: [ :name ]),
                try:       {
                  escape_query:    true,
                  search_endpoint: {
                    search_engine:         'os',
                    endpoint_url:          'https://opensearch.example.com/tmdb/_search',
                    api_method:            'POST',
                    basic_auth_credential: 'reader:reader',
                    proxy_requests:        false,
                  },
                },
                queries:     [],
              }

              assert_no_difference 'SearchEndpoint.count' do
                post :create, params: { case: data, format: :json }
              end

              assert_response :bad_request

              body = response.parsed_body
              assert_includes body['proxy_requests'],
                              'must be enabled when basic auth credentials are present'
            end
          end

          test 'does not duplicate an existing endpoint with basic_auth_credential' do
            # basic_auth_credential is encrypted non-deterministically, so a naive find_by
            # that includes it can never match an existing row and would silently create a
            # duplicate endpoint on every import. This test locks in the lookup behavior.
            existing = SearchEndpoint.create!(
              name:                  'Shared OS',
              endpoint_url:          'https://opensearch.example.com/tmdb/_search',
              search_engine:         'os',
              api_method:            'POST',
              basic_auth_credential: 'reader:reader',
              proxy_requests:        true,
              owner:                 user
            )

            data = {
              case_name:   'reimport case',
              owner_email: user.email,
              scorer:      acase.scorer.as_json(only: [ :name ]),
              try:         {
                escape_query:    true,
                search_endpoint: {
                  name:                  existing.name,
                  endpoint_url:          existing.endpoint_url,
                  search_engine:         existing.search_engine,
                  api_method:            existing.api_method,
                  basic_auth_credential: 'reader:reader',
                  proxy_requests:        true,
                },
              },
              queries:     [],
            }

            assert_no_difference 'SearchEndpoint.count' do
              post :create, params: { case: data, format: :json }
            end

            assert_response :created

            imported = Case.find_by(case_name: 'reimport case')
            assert_equal existing, imported.tries.first.search_endpoint
          end

          test 'creates a new case' do
            data = {
              case_name:   'test case',
              owner_email: user.email,
              scorer:      acase.scorer.as_json(only: [ :name ]),
              try:         {
                curator_variables: [ {
                  name:  'anInt',
                  value: 1,
                } ],
                escape_query:      true,
                search_endpoint:   search_endpoint.as_json(except: [ :id, :owner_id, :created_at, :updated_at ]),
              },
              queries:     [
                {
                  arranged_at:      1,
                  arranged_next:    nil,
                  query_text:       'First Query',
                  options:          nil,
                  notes:            nil,
                  information_need: 'I am the first query',
                  ratings:          [],
                },
                {
                  arranged_at:      2,
                  arranged_next:    nil,
                  query_text:       'Second Query',
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
            assert_equal 1, @case.tries.first.curator_variables.count
            assert_equal user, @case.owner
            assert_equal search_endpoint.endpoint_url, @case.tries.first.search_endpoint.endpoint_url
          end
        end
      end
    end
  end
end
