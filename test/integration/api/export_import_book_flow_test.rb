# frozen_string_literal: true

require 'test_helper'

class ExportImportBookFlowTest < ActionDispatch::IntegrationTest
  include ActionMailer::TestHelper

  let(:book) { books(:james_bond_movies) }

  test 'Export a complete book, and then modify the name, the scorer, and reimport it with same users' do
    post users_login_url params: { user: { email: 'doug@example.com', password: 'password' }, format: :json }

    # export the book
    Bullet.enable = false # we have extra nesting we don't care about
    get api_book_url(book), params: { export: true }
    Bullet.enable = true

    assert_response :ok

    response_json = response.parsed_body

    # Modify the book into a NEW book and import.
    response_json['name'] = 'New James Bond Movies'
    response_json['scorer']['name'] = 'New James Bond Movies Scorer'

    puts JSON.pretty_generate(response_json)

    post users_login_url params: { user: { email: 'doug@example.com', password: 'password' }, format: :json }
  end
end
