# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    class TriesControllerTest < ActionController::TestCase
      let(:joey) { users(:joey) }

      before do
        @controller = Api::V1::TriesController.new

        login_user joey
      end

      def assert_try_matches_response response, try
        assert_equal try.query_params, response['query_params']
        assert_equal try.field_spec,   response['field_spec'] if response['field_spec']
        assert_nil_or_equal try.search_url, response['search_url']
        assert_equal try.try_number,   response['try_number']
        assert_equal try.name,         response['name'] if response['name']
        assert_equal try.solr_args,    response['args']
        assert_equal try.escape_query, response['escape_query']
        assert_nil_or_equal try.api_method, response['api_method']

        assert_curator_vars_equal try.curator_vars_map, response['curator_vars']
      end

      def assert_try_matches_params params, try
        assert_equal try.query_params, params[:query_params] if params[:query_params]
        assert_equal try.field_spec,   params[:field_spec]   if params[:field_spec]
        assert_equal try.search_url,   params[:search_url]   if params[:search_url]
        assert_equal try.name,         params[:name]         if params[:name]
        assert_equal try.escape_query, params[:escape_query] if params[:escape_query]
        assert_equal try.api_method,   params[:api_method]   if params[:api_method]
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

      describe 'Fetches case tries' do
        let(:case_with_one_try)   { cases(:case_with_one_try) }
        let(:case_with_two_tries) { cases(:case_with_two_tries) }
        let(:shared_case)         { cases(:shared_team_case) }

        test 'returns a not found error if case does not exist' do
          get :index, params: { case_id: 'foo' }

          assert_response :not_found
        end

        test 'returns all tries for a case' do
          get :index, params: { case_id: case_with_one_try.id }

          assert_response :ok

          body  = response.parsed_body
          tries = body['tries']

          assert_equal tries.count, 1

          get :index, params: { case_id: case_with_two_tries.id }

          assert_response :ok

          body  = response.parsed_body
          tries = body['tries']

          assert_equal tries.count, 2
        end

        test 'works for a shared case as well' do
          get :index, params: { case_id: shared_case.id }

          first_try = shared_case.tries.first

          assert_response :ok

          body  = response.parsed_body
          tries = body['tries']

          ids = tries.map { |each| each['try_number'] }

          assert_includes ids, first_try.try_number
        end
      end

      describe 'Fetches a specific case try' do
        let(:case_with_one_try)   { cases(:case_with_one_try) }
        let(:case_with_two_tries) { cases(:case_with_two_tries) }

        let(:first_for_case_with_two_tries)   { tries(:first_for_case_with_two_tries) }
        let(:second_for_case_with_two_tries)  { tries(:second_for_case_with_two_tries) }

        test 'returns a not found error when try does not exist' do
          get :show, params: { case_id: case_with_two_tries.id, try_number: 1234 }

          assert_response :not_found
        end

        test 'returns a specific case try' do
          get :show, params: { case_id: case_with_two_tries.id, try_number: first_for_case_with_two_tries.try_number }

          assert_response :ok

          body = response.parsed_body

          assert_try_matches_response body, first_for_case_with_two_tries

          get :show, params: { case_id: case_with_two_tries.id, try_number: second_for_case_with_two_tries.try_number }

          assert_response :ok

          body = response.parsed_body

          assert_try_matches_response body, second_for_case_with_two_tries
        end
      end

      describe 'Updates case tries' do
        let(:the_case)  { cases(:case_with_two_tries) }
        let(:the_try)   { tries(:first_for_case_with_two_tries) }

        test 'renames try successfully' do
          put :update, params: { case_id: the_case.id, try_number: the_try.try_number, try: { name: 'New Name' } }

          assert_response :ok

          the_try.reload
          assert_equal the_try.name, 'New Name'

          the_try = response.parsed_body
          assert_equal the_try['name'], 'New Name'
        end

        test 'can change other parameters too' do
          old_no = the_try.try_number
          put :update, params: { case_id: the_case.id, try_number: the_try.try_number, try: { query_params: 'New No' } }

          assert_response :ok

          the_try.reload
          assert_not_equal  the_try.try_number, 'New No'
          assert_equal      the_try.try_number, old_no

          put :update,
              params: { case_id: the_case.id, try_number: the_try.try_number, try: { field_spec: 'New field_spec' } }

          assert_response :ok

          the_try.reload
          assert_equal the_try.field_spec, 'New field_spec'
        end
      end

      describe 'Creates new case tries' do
        let(:the_case) { cases(:case_with_one_try) }

        test 'sets attribute successfully and assigns try to case' do
          try_params = {
            search_url:    'http://solr.quepid.com',
            field_spec:    'catch_line',
            query_params:  'q=#$query##',
            search_engine: 'solr',
          }

          case_last_try = the_case.last_try_number

          assert_difference 'the_case.tries.count' do
            post :create, params: { case_id: the_case.id, try: try_params }

            assert_response :ok # should be :created,
            # but there's a bug currently in the responders gem

            the_case.reload
            try_response  = response.parsed_body
            created_try   = the_case.tries.where(try_number: try_response['try_number']).first

            assert_equal the_case.last_try_number, case_last_try + 1

            assert_try_matches_response try_response,  created_try
            assert_try_matches_params   try_params,    created_try

            expected_value = { 'q' => [ '#$query##' ] }

            assert expected_value == try_response['args']
          end
        end

        test 'tracks creating a child try from a parent try' do
          the_try = the_case.tries.latest

          try_params = {
            search_url:    'http://solr.quepid.com',
            field_spec:    'catch_line',
            query_params:  'q=#$query##',
            search_engine: 'solr',
            parent_id:     the_try.id,
          }

          assert_difference 'the_case.tries.count' do
            post :create, params: { case_id: the_case.id, try: try_params }

            assert_response :ok # should be :created,
            # but there's a bug currently in the responders gem

            the_case.reload
            the_try.reload
            try_response  = response.parsed_body
            created_try   = the_case.tries.where(try_number: try_response['try_number']).first

            assert_includes the_try.children, created_try
          end
        end

        test 'adds curator vars to the try' do
          try_params = {
            search_url:    'http://solr.quepid.com',
            field_spec:    'catch_line',
            query_params:  'q=#$query##',
            search_engine: 'solr',
          }

          curator_vars_params = {
            var1: '1',
            var2: '2',
          }

          assert_difference 'CuratorVariable.count', 2 do
            post :create, params: { case_id: the_case.id, try: try_params, curator_vars: curator_vars_params }

            assert_response :ok

            try_response  = json_response
            created_try   = the_case.tries.where(try_number: try_response['try_number']).first

            assert_try_matches_response try_response,  created_try
            assert_try_matches_params   try_params,    created_try

            expected_value = { 'q' => [ '#$query##' ] }

            assert expected_value == try_response['args']
          end
        end

        test 'sets default name properly' do
          try_params = {
            search_url:    'http://solr.quepid.com',
            field_spec:    'catch_line',
            query_params:  'q=#$query##',
            search_engine: 'solr',
          }

          post :create, params: { case_id: the_case.id, try: try_params }

          assert_response :ok # should be :created,
          # but there's a bug currently in the responders gem

          the_case.reload
          try_response  = response.parsed_body
          created_try   = the_case.tries.where(try_number: try_response['try_number']).first

          assert_match( /Try/,                         created_try.name )
          assert_match( /#{the_case.last_try_number}/, created_try.name )
          assert_match( /#{created_try.try_number}/,   created_try.name )

          assert_match( /Try/,                            try_response['name'] )
          assert_match( /#{the_case.last_try_number}/,    try_response['name'] )
          assert_match( /#{try_response['try_number']}/,  try_response['name'] )
        end

        test 'sets escape_query param' do
          post :create, params: { case_id: the_case.id, try: { escape_query: false } }

          assert_response :ok

          the_case.reload
          created_try = the_case.tries.where(try_number: json_response['try_number']).first

          assert_equal false, json_response['escape_query']
          assert_equal false, created_try.escape_query
        end

        test 'sets api_method param' do
          post :create, params: { case_id: the_case.id, try: { api_method: 'get' } }

          assert_response :ok

          the_case.reload
          created_try = the_case.tries.where(try_number: json_response['try_number']).first

          assert_equal 'get', json_response['api_method']
          assert_equal 'get', created_try.api_method
        end

        test 'sets number of rows' do
          post :create, params: { case_id: the_case.id, try: { number_of_rows: 20 } }

          assert_response :ok

          the_case.reload
          created_try = the_case.tries.where(try_number: json_response['try_number']).first

          assert_equal 20, created_try.number_of_rows
          assert_equal 20, json_response['number_of_rows']
        end

        test 'assigns default attributes' do
          post :create, params: { case_id: the_case.id, try: { name: '' } }

          assert_response :ok # should be :created,
          # but there's a bug currently in the responders gem

          the_case.reload
          try_response  = response.parsed_body
          created_try   = the_case.tries.where(try_number: try_response['try_number']).first

          assert_match( /Try/,                         created_try.name )
          assert_match( /#{the_case.last_try_number}/, created_try.name )
          assert_match( /#{created_try.try_number}/,   created_try.name )

          assert_not_nil created_try.search_engine
          assert_nil created_try.field_spec
          assert_nil created_try.search_url
          assert_nil created_try.query_params
          assert created_try.escape_query

          # assert_equal created_try.search_engine,   Try::DEFAULTS[:search_engine]
          # assert_equal created_try.field_spec,      Try::DEFAULTS[:solr][:field_spec]
          # assert_equal created_try.search_url,      Try::DEFAULTS[:solr][:search_url]
          # assert_equal created_try.escape_query,    true
          # assert_equal created_try.api_method,      Try::DEFAULTS[:solr][:api_method]
          assert_equal created_try.number_of_rows, 10
        end

        describe 'analytics' do
          test 'posts event' do
            expects_any_ga_event_call

            perform_enqueued_jobs do
              post :create, params: { case_id: the_case.id, try: { name: 'blah' } }

              assert_response :ok
            end
          end
        end
      end

      describe 'Deletes cases tries' do
        let(:the_case)  { cases(:case_with_two_tries) }
        let(:the_try)   { tries(:first_for_case_with_two_tries) }

        test 'returns a not found error if try does not exist' do
          delete :destroy, params: { case_id: the_case.id, try_number: 123_456 }

          assert_response :not_found
        end

        test 'successfully removes try from case tries' do
          assert_difference 'the_case.tries.count', -1 do
            delete :destroy, params: { case_id: the_case.id, try_number: the_try.try_number }

            assert_response :no_content
          end
        end

        it 'successfully deletes a try with curator vars' do
          the_try.curator_variables.create name: 'foo', value: 1

          assert_difference 'the_case.tries.count', -1 do
            delete :destroy, params: { case_id: the_case.id, try_number: the_try.try_number }

            assert_response :no_content
          end
        end
      end

      describe 'Supports multiple search engines' do
        let(:the_case)  { cases(:case_with_one_try) }

        describe 'Solr' do
          test 'sets the proper default values' do
            post :create, params: { case_id: the_case.id, try: { name: '' } }

            assert_response :ok # should be :created,
            # but there's a bug currently in the responders gem

            the_case.reload
            try_response  = response.parsed_body
            created_try   = the_case.tries.where(try_number: try_response['try_number']).first

            assert_match( /Try/,                         created_try.name )
            assert_match( /#{the_case.last_try_number}/, created_try.name )
            assert_match( /#{created_try.try_number}/,   created_try.name )

            assert_not_nil created_try.search_engine
            assert_equal created_try.escape_query, true
          end
        end

        describe 'Elasticsearch' do
          test 'sets the proper default values' do
            post :create, params: { case_id: the_case.id, try: { search_engine: 'es' } }

            assert_response :ok # should be :created,
            # but there's a bug currently in the responders gem

            the_case.reload
            try_response  = response.parsed_body
            created_try   = the_case.tries.where(try_number: try_response['try_number']).first

            assert_match( /Try/,                         created_try.name )
            assert_match( /#{the_case.last_try_number}/, created_try.name )
            assert_match( /#{created_try.try_number}/,   created_try.name )

            assert_not_nil created_try.search_engine
            assert_not_nil created_try.escape_query

            assert_equal created_try.search_engine, 'es'
            assert_equal created_try.escape_query,  true
          end

          test 'parses args properly' do
            query_params = '{ "query": "#$query##" }'

            post :create, params: { case_id: the_case.id, try: { search_engine: 'es', query_params: query_params } }

            assert_response :ok # should be :created,
            # but there's a bug currently in the responders gem

            the_case.reload
            try_response  = response.parsed_body
            created_try   = the_case.tries.where(try_number: try_response['try_number']).first

            assert_equal created_try.args,      'query' => '#$query##'
            assert_equal try_response['args'],  'query' => '#$query##'
          end

          test 'handles bad JSON in query params' do
            query_params = '{ "query": "#$query##"'

            post :create, params: { case_id: the_case.id, try: { search_engine: 'es', query_params: query_params } }

            assert_response :ok # should be :created,
            # but there's a bug currently in the responders gem

            the_case.reload
            try_response  = response.parsed_body
            created_try   = the_case.tries.where(try_number: try_response['try_number']).first

            assert_nil created_try.args
            assert_nil try_response['args']
          end
        end
      end
    end
  end
end
