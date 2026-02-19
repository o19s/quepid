# frozen_string_literal: true

require 'test_helper'

module Core
  module Queries
    class NotesControllerTest < ActionController::TestCase
      let(:user) { users(:random) }
      let(:acase) { cases(:queries_case) }
      let(:query) { acase.queries.first }

      before do
        @controller = Core::Queries::NotesController.new
        login_user user
      end

      describe 'update' do
        test 'saves notes and returns turbo frame html' do
          put :update,
              params: { id: acase.id, query_id: query.id, query: { information_need: 'find sci-fi movies', notes: 'Important query' } },
              format: :html

          assert_response :ok
          assert_includes response.body, "query_notes_#{query.id}"
          assert_includes response.body, 'find sci-fi movies'
          assert_includes response.body, 'Important query'

          query.reload
          assert_equal 'find sci-fi movies', query.information_need
          assert_equal 'Important query', query.notes
        end

        test 'returns turbo frame with flash notice on success' do
          put :update,
              params: { id: acase.id, query_id: query.id, query: { information_need: 'test', notes: 'test' } },
              format: :html

          assert_response :ok
          assert_includes response.body, 'Notes saved'
        end

        test 'returns 404 when query not found' do
          put :update,
              params: { id: acase.id, query_id: 999_999, query: { information_need: 'test', notes: 'test' } },
              format: :html

          assert_response :not_found
        end
      end
    end
  end
end
