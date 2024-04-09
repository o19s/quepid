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

        describe 'Exporting a book in triggers a job' do
          let(:book)        { books(:james_bond_movies) }
          let(:doug)        { users(:doug) }

          test 'the book returns a message on start' do
            assert doug.books.include? book

            get :show, params: { book_id: book.id }
            assert_response :ok
            body = response.parsed_body

            assert_equal body['message'], 'Starting export of book as file.'
          end

          test 'duplicate calls report back in progress work' do
            get :show, params: { book_id: book.id }
            assert_response :ok

            # duplicate call
            get :show, params: { book_id: book.id }
            assert_response :ok
            body = response.parsed_body

            assert_equal body['message'], 'Currently exporting book as file.'

            get :show, params: { book_id: book.id }
            assert_response :ok
            body = response.parsed_body

            assert_equal body['message'], 'Currently exporting book as file.'
          end

          test 'running a job and waiting gives you the resulting zip file' do
            get :show, params: { book_id: book.id }
            assert_response :ok
            body = response.parsed_body

            assert_equal body['message'], 'Starting export of book as file.'

            perform_enqueued_jobs

            get :show, params: { book_id: book.id }
            assert_response :ok
            body = response.parsed_body
            assert_not_nil body['download_file_url']
          end
        end
      end
    end
  end
end
