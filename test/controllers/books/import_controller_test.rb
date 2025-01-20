# frozen_string_literal: true

# test/controllers/books/import_controller_test.rb
require 'test_helper'
require 'zip'

module Books
  class BooksControllerTest < ActionDispatch::IntegrationTest
    let(:user) { users(:random) }

    def setup
      @valid_json = { 'scorer' => { 'name' =>'AP@10' }, selection_strategy: { 'name'=>'Single Rater' } }
      @json_file = Tempfile.new([ 'test', '.json' ])
      @json_file.write(@valid_json.to_json)
      @json_file.rewind

      @zip_file = Tempfile.new([ 'test', '.zip' ])
      Zip::File.open(@zip_file, Zip::File::CREATE) do |zipfile|
        zipfile.add(File.basename(@json_file), @json_file)
      end

      # get the login page
      get '/books'
      assert_equal 302, status
      follow_redirect!

      login_user_for_integration_test user
    end

    def teardown
      @json_file.close
      @json_file.unlink
      @zip_file.close
      @zip_file.unlink
    end

    test 'should import a valid JSON file' do
      json_upload = Rack::Test::UploadedFile.new(@json_file.path, 'application/json')

      post books_import_index_url, params: { book: { import_file: json_upload } }

      assert_response :redirect
      assert_redirected_to book_path(Book.last)
    end

    test 'should import a valid ZIP file containing a JSON file' do
      zip_upload = Rack::Test::UploadedFile.new(@zip_file.path, 'application/zip')

      post books_import_index_url, params: { book: { import_file: zip_upload } }

      assert_response :redirect
      assert_redirected_to book_path(Book.last)
    end
  end
end
