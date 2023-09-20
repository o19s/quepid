# frozen_string_literal: true

require 'test_helper'
require 'csv'
module Api
  module V1
    module Export
      class BooksControllerTest < ActionController::TestCase
        let(:doug) { users(:doug) }

        before do
          @controller = Api::V1::Export::BooksController.new

          login_user doug
        end

        describe 'Exporting a book in json' do
          let(:book)        { books(:james_bond_movies) }
          let(:doug)        { users(:doug) }

          test 'the AR object ids are replaced with names' do
            get :show, params: { book_id: book.id }
            assert_response :ok
            body = response.parsed_body

            assert_nil body['book_id']
            assert_not_nil body['name']

            assert_nil body['scorer_id']
            assert_not_nil body['scorer']
            assert_nil body['scorer']['scorer_id']

            assert_nil body['selection_strategy_id']
            assert_not_nil body['selection_strategy']
          end
        end
      end
    end
  end
end
