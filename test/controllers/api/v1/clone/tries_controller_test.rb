# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    module Clone
      class TriesControllerTest < ActionController::TestCase
        let(:joey) { users(:joey) }

        before do
          @controller = Api::V1::Clone::TriesController.new

          login_user joey
        end

        def assert_try_matches_response response, try
          assert_equal try.query_params, response['query_params']
          assert_equal try.field_spec,   response['field_spec']
          assert_equal try.search_url,   response['search_url']
          assert_equal try.try_number,   response['try_number']
          assert_equal try.name,         response['name']
          assert_equal try.solr_args,    response['args']
          assert_equal try.escape_query, response['escape_query']

          assert_curator_vars_equal try.curator_vars_map, response['curatorVars']
        end

        def assert_tries_match a_try, try
          assert_equal try.case_id,      a_try.case_id
          assert_equal try.query_params, a_try.query_params
          assert_equal try.search_url,   a_try.search_url
          assert_equal try.escape_query, a_try.escape_query
        end

        def assert_curator_vars_equal vars, response_vars
          if vars.blank?
            assert_equal({}, response_vars)
          else
            vars.each do |key, value|
              assert_equal response_vars[key.to_s], value
            end
          end
        end

        describe 'Duplicate Try' do
          let(:the_case)  { cases(:case_with_two_tries) }
          let(:the_try)   { tries(:first_for_case_with_two_tries) }

          it 'returns a not found error if try does not exist' do
            post :create, params: { case_id: the_case.id, try_number: 123_456 }

            assert_response :not_found
          end

          it 'successfully duplicates try for case' do
            assert_difference 'the_case.tries.count' do
              post :create, params: { case_id: the_case.id, try_number: the_try.try_number }

              assert_response :ok

              the_case.reload
              try_response  = JSON.parse(response.body)
              created_try   = the_case.tries.first

              assert_try_matches_response try_response, created_try
              assert_tries_match          the_try,      created_try
            end
          end

          describe 'analytics' do
            it 'posts event' do
              expects_any_ga_event_call

              perform_enqueued_jobs do
                post :create, params: { case_id: the_case.id, try_number: the_try.try_number }

                assert_response :ok
              end
            end
          end
        end
      end
    end
  end
end
