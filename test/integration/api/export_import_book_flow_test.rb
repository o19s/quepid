# frozen_string_literal: true

require 'test_helper'

class ExportImportBookFlowTest < ActionDispatch::IntegrationTest
  include ActionMailer::TestHelper

  let(:book) { books(:james_bond_movies) }
  let(:team) { teams(:shared) }

  test 'Export a complete book, and then modify the name, the scorer, and reimport it with same users' do
    post users_login_url params: { user: { email: 'doug@example.com', password: 'password' }, format: :json }

    # export the book
    Bullet.enable = false # we have extra nesting we don't care about
    get api_export_book_url(book)
    Bullet.enable = true

    assert_response :ok

    response_json = response.parsed_body

    # Modify the book into a NEW book and import.
    response_json['name'] = 'New James Bond Movies'

    puts JSON.pretty_generate(response_json)

    post api_import_books_url params: { team_id: team.id, book: response_json, format: :json }

    puts response.parsed_body

    new_book = Book.find(response.parsed_body['id'])
    assert_not_nil(new_book)
  end
end
