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
          let(:book) { books(:james_bond_movies) }
          let(:doug) { users(:doug) }

          test 'the book returns a message on start' do
            assert_includes doug.books, book

            post :update, params: { book_id: book.id }
            assert_response :ok
            body = response.parsed_body

            assert_equal 'Starting export of book as file.', body['message']
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

            assert_equal 'Starting export of book as file.', body['message']

            perform_enqueued_jobs

            get :show, params: { book_id: book.id }
            assert_response :ok
            body = response.parsed_body
            assert_not_nil body['download_file_url']
          end

          test 'enqueue failure preserves the completed export and its file' do
            book.export_file.attach(io: StringIO.new('completed export'), filename: 'completed.zip')
            original_blob_id = book.export_file.blob.id
            original_enqueue = ExportBookJob.method(:perform_later)
            ExportBookJob.define_singleton_method(:perform_later) { |*| raise 'queue unavailable' }

            assert_raises(RuntimeError) do
              post :update, params: { book_id: book.id }
            end

            assert_nil book.reload.export_job
            assert_equal original_blob_id, book.export_file.blob.id
            assert_equal 'completed export', book.export_file.download
            assert_no_enqueued_jobs only: ActiveStorage::PurgeJob
          ensure
            ExportBookJob.define_singleton_method(:perform_later, original_enqueue) if original_enqueue
          end

          test 'polling a running export never returns an older attachment' do
            book.export_file.attach(io: StringIO.new('old export'), filename: 'old.zip')
            book.update!(export_job: 'running')

            assert_no_enqueued_jobs only: ExportBookJob do
              get :show, params: { book_id: book.id }
            end
            assert_response :ok
            assert_nil response.parsed_body['download_file_url']
            assert_includes response.parsed_body['message'], 'running'
          end

          test 'update rebuilds completed exports while GET polls without queuing jobs' do
            post :update, params: { book_id: book.id }
            perform_enqueued_jobs only: ExportBookJob
            original_blob_id = book.reload.export_file.blob.id

            assert_no_enqueued_jobs only: ExportBookJob do
              get :show, params: { book_id: book.id }
            end
            assert_not_nil response.parsed_body['download_file_url']
            assert_equal original_blob_id, book.reload.export_file.blob.id

            book.update!(name: 'Updated export contents')
            assert_enqueued_jobs 1, only: ExportBookJob do
              post :update, params: { book_id: book.id }
            end
            assert_equal 'Starting export of book as file.', response.parsed_body['message']
            assert_not book.reload.export_file.attached?

            assert_no_enqueued_jobs only: ExportBookJob do
              post :update, params: { book_id: book.id }
            end
            perform_enqueued_jobs only: ExportBookJob

            assert_no_enqueued_jobs only: ExportBookJob do
              get :show, params: { book_id: book.id }
            end
            assert_not_nil response.parsed_body['download_file_url']
            assert_not_equal original_blob_id, book.reload.export_file.blob.id
            Zip::File.open_buffer(book.export_file.download) do |zip|
              assert_equal 'Updated export contents', JSON.parse(zip.first.get_input_stream.read)['name']
            end
          end
        end
      end
    end
  end
end
