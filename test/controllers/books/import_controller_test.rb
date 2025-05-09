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

    test 'should handle incorrectly formatted JSON file without blowing up' do
      wrong_json_format = <<~EOF
        [
         {
           "search_term": "abzorb powder",
           "search_term_type": "otc_searches",
           "sku_id": 964063,
           "sku_name": "Abzorb Anti Fungal Dusting Powder | Absorbs Excess Sweat | Controls Itching | Derma Care | Manages Fungal Infections",
           "score_check": 143847.81,
           "score_range": 10
         }
        ]
      EOF

      json_string = StringIO.new(wrong_json_format)
      json_upload = Rack::Test::UploadedFile.new(json_string, 'application/json', original_filename: 'test.json')

      post books_import_index_url, params: { book: { import_file: json_upload } }

      assert_response :ok
      assert_match(/Invalid JSON file/, response.body)
    end

    test 'should handle non JSON file upload' do
      not_json_format = <<~EOF
        [
         {
           "search_term": abzorb powder,#{'         '}
         }}}}}}}}}}}}}}}}}}}}}}}
        ]
      EOF

      json_string = StringIO.new(not_json_format)
      json_upload = Rack::Test::UploadedFile.new(json_string, 'application/json', original_filename: 'test.json')

      post books_import_index_url, params: { book: { import_file: json_upload } }

      assert_response :ok
      assert_match(/Invalid JSON file/, response.body)
    end
  end
end
