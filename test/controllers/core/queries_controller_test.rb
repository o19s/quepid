# frozen_string_literal: true

require 'test_helper'

module Core
  class QueriesControllerTest < ActionController::TestCase
    let(:user) { users(:random) }
    let(:acase) { cases(:queries_case) }
    let(:atry) { acase.tries.latest }

    before do
      @controller = Core::QueriesController.new
      login_user user
    end

    describe 'create' do
      test 'returns turbo stream when format is turbo_stream' do
        post :create,
             params: { id: acase.id, try_number: atry.try_number, query: { query_text: 'New query via Turbo' } },
             format: :turbo_stream

        assert_response :created
        assert_equal 'text/vnd.turbo-stream.html', response.media_type
        assert_includes response.body, 'query_row_'
        assert_includes response.body, 'New query via Turbo'
      end

      test 'creates query and appends row' do
        initial_count = acase.queries.count
        post :create,
             params: { id: acase.id, try_number: atry.try_number, query: { query_text: 'Another new query' } },
             format: :turbo_stream

        assert_response :created
        acase.reload
        assert_equal initial_count + 1, acase.queries.count
        assert acase.queries.exists?(query_text: 'Another new query')
      end

      test 'redirects when format is html' do
        post :create,
             params: { id: acase.id, try_number: atry.try_number, query: { query_text: 'HTML format query' } },
             format: :html

        assert_redirected_to case_core_path(acase, atry)
        assert acase.queries.exists?(query_text: 'HTML format query')
      end

      test 'returns turbo stream with flash alert for blank query text' do
        post :create,
             params: { id: acase.id, query: { query_text: '' } },
             format: :turbo_stream

        assert_response :unprocessable_entity
        assert_equal 'text/vnd.turbo-stream.html', response.media_type
        assert_includes response.body, 'append'
        assert_includes response.body, 'flash'
        assert_includes response.body, 'alert'
      end
    end

    describe 'destroy' do
      let(:query) { acase.queries.first }

      test 'returns turbo stream when format is turbo_stream' do
        delete :destroy,
               params: { id: acase.id, query_id: query.id },
               format: :turbo_stream

        assert_response :ok
        assert_equal 'text/vnd.turbo-stream.html', response.media_type
        assert_includes response.body, "query_row_#{query.id}"
        assert_includes response.body, 'remove'
      end

      test 'destroys query' do
        query_id = query.id
        delete :destroy,
               params: { id: acase.id, query_id: query_id },
               format: :turbo_stream

        assert_response :ok
        assert_nil acase.queries.find_by(id: query_id)
      end

      test 'redirects when format is html' do
        delete :destroy,
               params: { id: acase.id, query_id: query.id, try_number: atry.try_number },
               format: :html

        assert_redirected_to case_core_path(acase, atry)
      end

      test 'appends empty placeholder when deleting last query' do
        single_case = cases(:case_single_query)
        single_query = single_case.queries.first

        delete :destroy,
               params: { id: single_case.id, query_id: single_query.id },
               format: :turbo_stream

        assert_response :ok
        assert_includes response.body, 'query_list_empty_placeholder'
        assert_includes response.body, 'No queries yet'
      end
    end
  end
end
