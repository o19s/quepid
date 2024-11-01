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

            post :update, params: { book_id: book.id }
            assert_response :ok
            body = response.parsed_body

            assert_equal body['message'], 'Starting export of book as file.'
          end

          test 'duplicate calls report back in progress work' do
            post :update, params: { book_id: book.id }
            assert_response :ok

            assert_enqueued_with(job: ExportBookJob, args: [ book ])
            book.reload
            assert book.export_job.starts_with? 'queued at'
            # assert book.job_statuses

            # duplicate call
            post :update, params: { book_id: book.id }
            assert_response :ok
            body = response.parsed_body
            assert body['message'].start_with? 'Currently exporting book as file.  Status is queued at'

            post :update, params: { book_id: book.id }
            assert_response :ok
            body = response.parsed_body
            assert body['message'].start_with? 'Currently exporting book as file.  Status is queued at'
          end

          test 'running a job and waiting gives you the resulting zip file' do
            post :update, params: { book_id: book.id }
            assert_response :ok
            body = response.parsed_body

            assert_equal body['message'], 'Starting export of book as file.'

            perform_enqueued_jobs

            post :update, params: { book_id: book.id }
            assert_response :ok
            body = response.parsed_body
            assert_not_nil body['download_file_url']
          end
        end
      end
    end
  end
end
