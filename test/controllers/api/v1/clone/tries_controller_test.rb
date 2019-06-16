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
          assert_equal try.queryParams, response['queryParams']
          assert_equal try.fieldSpec,   response['fieldSpec']
          assert_equal try.searchUrl,   response['searchUrl']
          assert_equal try.tryNo,       response['tryNo']
          assert_equal try.name,        response['name']
          assert_equal try.solr_args,   response['args']
          assert_equal try.escapeQuery, response['escapeQuery']

          assert_curator_vars_equal try.curator_vars_map, response['curatorVars']
        end

        def assert_tries_match a_try, try
          assert_equal try.case_id,     a_try.case_id
          assert_equal try.queryParams, a_try.queryParams
          assert_equal try.searchUrl,   a_try.searchUrl
          assert_equal try.escapeQuery, a_try.escapeQuery
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
            post :create, case_id: the_case.id, tryNo: 123_456

            assert_response :not_found
          end

          it 'successfully duplicates try for case' do
            assert_difference 'the_case.tries.count' do
              post :create, case_id: the_case.id, tryNo: the_try.tryNo

              assert_response :ok

              the_case.reload
              try_response  = JSON.parse(response.body)
              created_try   = the_case.tries.last

              assert_try_matches_response try_response, created_try
              assert_tries_match          the_try,      created_try
            end
          end

          describe 'analytics' do
            it 'posts event' do
              expects_any_ga_event_call

              perform_enqueued_jobs do
                post :create, case_id: the_case.id, tryNo: the_try.tryNo

                assert_response :ok
              end
            end
          end
        end
      end
    end
  end
end
