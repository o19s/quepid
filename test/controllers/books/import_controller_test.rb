# frozen_string_literal: true

# test/controllers/books/import_controller_test.rb
require 'test_helper'
require 'zip'

module Books
  class BooksControllerTest < ActionDispatch::IntegrationTest
    let(:user) { users(:random) }

    # rubocop:disable Minitest/AssertionInLifecycleHook
    def setup
      @valid_json = { 'scorer' => { 'name' =>'AP@10' } }
      @json_file = Tempfile.new([ 'test', '.json' ])
      @json_file.write(@valid_json.to_json)
      @json_file.rewind

      @zip_file = Tempfile.new([ 'test', '.zip' ])
      Zip::File.open(@zip_file, create: true) do |zipfile|
        zipfile.add(File.basename(@json_file), @json_file)
      end

      # get the login page
      get '/books'
      assert_equal 302, status
      follow_redirect!

      login_user_for_integration_test user
    end
    # rubocop:enable Minitest/AssertionInLifecycleHook

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
      wrong_json_format = <<~FILE_CONTENT
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
      FILE_CONTENT

      json_string = StringIO.new(wrong_json_format)
      json_upload = Rack::Test::UploadedFile.new(json_string, 'application/json', original_filename: 'test.json')

      post books_import_index_url, params: { book: { import_file: json_upload } }

      assert_response :unprocessable_content
      assert_match(/Invalid JSON file/, response.body)
    end

    test 'should handle non JSON file upload' do
      not_json_format = <<~FILE_CONTENT
        [
         {
           "search_term": abzorb powder,#{'         '}
         }}}}}}}}}}}}}}}}}}}}}}}
        ]
      FILE_CONTENT

      json_string = StringIO.new(not_json_format)
      json_upload = Rack::Test::UploadedFile.new(json_string, 'application/json', original_filename: 'test.json')

      post books_import_index_url, params: { book: { import_file: json_upload } }

      assert_response :unprocessable_content
      assert_match(/Invalid JSON file/, response.body)
    end

    test 'PATCH update queues additional data import into an existing book without touching its name or owner' do
      existing_book = Book.create!(name: 'Existing Book', owner: user)
      payload = { query_doc_pairs: [ { query_text: 'new query', doc_id: 'doc-99', document_fields: { title: 'New' } } ] }
      upload = upload_for(payload)

      assert_enqueued_with job: ImportBookJob do
        patch books_import_url(existing_book), params: { book: { import_file: upload } }
      end

      assert_redirected_to book_path(existing_book)

      perform_enqueued_jobs

      existing_book.reload
      assert_equal 'Existing Book', existing_book.name
      assert_equal user, existing_book.owner
      added = existing_book.query_doc_pairs.find_by(doc_id: 'doc-99')
      assert_equal 'new query', added.query_text
    end

    test 'PATCH update ignores book-level attributes from a re-exported file, only adding data' do
      existing_book = Book.create!(name: 'Existing Book', owner: user, scale: [ 0, 1 ], show_rank: true,
                                   support_implicit_judgements: false)
      payload = {
        name:                        'Renamed via re-import',
        scale:                       [ 0, 1, 2 ],
        scale_with_labels:           { '0' => 'bad', '1' => 'ok', '2' => 'great' },
        show_rank:                   false,
        support_implicit_judgements: true,
        scorer:                      { name: 'Some Scorer', scale: [ 0, 1, 2, 3 ] },
        query_doc_pairs:             [ { query_text: 'new query', doc_id: 'doc-99' } ],
      }
      upload = upload_for(payload)

      patch books_import_url(existing_book), params: { book: { import_file: upload } }
      perform_enqueued_jobs

      existing_book.reload
      assert_equal 'Existing Book', existing_book.name
      assert_equal [ 0, 1 ], existing_book.scale
      assert existing_book.show_rank
      assert_not existing_book.support_implicit_judgements
      assert_not_nil existing_book.query_doc_pairs.find_by(doc_id: 'doc-99')
    end

    test 'PATCH update upserts a query_doc_pair by query_doc_pair_id instead of duplicating it' do
      existing_book = Book.create!(name: 'Existing Book', owner: user)
      qdp = existing_book.query_doc_pairs.create!(query_text: 'old text', doc_id: 'doc-1')
      payload = { query_doc_pairs: [ { query_doc_pair_id: qdp.id, query_text: 'updated text', doc_id: 'doc-1' } ] }
      upload = upload_for(payload)

      patch books_import_url(existing_book), params: { book: { import_file: upload } }
      perform_enqueued_jobs

      assert_equal 1, existing_book.query_doc_pairs.reload.count
      assert_equal 'updated text', qdp.reload.query_text
    end

    test 'PATCH update imports standalone all_judgements, upserting the query_doc_pair by query_text/doc_id' do
      existing_book = Book.create!(name: 'Existing Book', owner: user)
      payload = {
        all_judgements: [
          {
            rating:         1.0,
            user_email:     user.email,
            query_doc_pair: { query_text: 'judged query', doc_id: 'doc-7' },
          }
        ],
      }
      upload = upload_for(payload)

      patch books_import_url(existing_book), params: { book: { import_file: upload } }
      perform_enqueued_jobs

      qdp = existing_book.query_doc_pairs.reload.find_by(doc_id: 'doc-7')
      assert_not_nil qdp
      judgement = qdp.judgements.find_by(user: user)
      assert_in_delta(1.0, judgement.rating)
    end

    test 'PATCH update re-renders edit with an error and leaves the book unchanged on invalid JSON' do
      existing_book = Book.create!(name: 'Existing Book', owner: user)
      json_string = StringIO.new('not valid json {')
      upload = Rack::Test::UploadedFile.new(json_string, 'application/json', original_filename: 'test.json')

      patch books_import_url(existing_book), params: { book: { import_file: upload } }

      assert_response :unprocessable_content
      assert_match(/Invalid JSON file/, response.body)
      assert_equal 'Existing Book', existing_book.reload.name
    end

    test 'PATCH update re-renders edit with an error instead of raising when query_doc_pairs is not an array' do
      existing_book = Book.create!(name: 'Existing Book', owner: user)
      upload = upload_for({ query_doc_pairs: 'not-an-array' })

      patch books_import_url(existing_book), params: { book: { import_file: upload } }

      assert_response :unprocessable_content
      assert_match(/Invalid JSON file/, response.body)
      assert_equal 'Existing Book', existing_book.reload.name
    end

    test 'PATCH update 404s for a book the user cannot access' do
      other_users_book = books(:empty_book_2)
      upload = upload_for({ query_doc_pairs: [] })

      patch books_import_url(other_users_book), params: { book: { import_file: upload } }

      assert_response :not_found
    end

    private

    def upload_for payload
      file = Tempfile.new([ 'import', '.json' ])
      file.write(payload.to_json)
      file.rewind
      Rack::Test::UploadedFile.new(file.path, 'application/json')
    end
  end
end
