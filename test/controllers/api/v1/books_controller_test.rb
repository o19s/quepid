# frozen_string_literal: true

require 'test_helper'
require 'csv'
module Api
  module V1
    class BooksControllerTest < ActionController::TestCase
      let(:doug) { users(:doug) }

      before do
        @controller = Api::V1::BooksController.new

        login_user doug
      end

      describe 'Exporting a book in json' do
        let(:book) { books(:james_bond_movies) }
        let(:book_of_comedy_films) { books(:book_of_comedy_films) }

        test "returns a not found error if the book is not in the signed in user's team list" do
          get :show, params: { id: book_of_comedy_films.id }
          assert_response :not_found
        end

        test 'returns book info' do
          get :show, params: { id: book.id }
          assert_response :ok

          body = response.parsed_body

          assert_equal body['name'].size, book.name.size
          assert_equal body['query_doc_pairs'][0]['query'], book.query_doc_pairs[0].query_text
        end
      end

      describe 'Exporting a book in basic csv format' do
        let(:book)        { books(:james_bond_movies) }
        let(:judgement)   { judgements(:qdp10_judgement) }
        let(:doug)        { users(:doug) }
        let(:random_user) { users(:random) }

        test 'returns book w/ query doc pairs and judgement info' do
          get :show, params: { id: book.id, format: :csv }

          assert_response :ok
          csv = CSV.parse(response.body, headers: true)

          assert_equal 'Action Movies', csv[0]['query']
          assert_equal 'Moonraker', csv[0]['docid']
          assert_equal '2.0', csv[0]['Random User']
          assert_equal '1.0', csv[0]['Doug Turnbull']

          assert_equal csv[1]['query'], book.query_doc_pairs[1].query_text
          assert_equal csv[1][book.query_doc_pairs[1].judgements[0].user.name],
                       book.query_doc_pairs[1].judgements[0].rating.to_s

          assert_not_includes csv.headers, 'Unknown'
        end

        test 'handles a rating that is not associated with a user, and adds Unknown' do
          judgement.user = nil
          judgement.save!
          get :show, params: { id: book.id, format: :csv }

          assert_response :ok
          csv = CSV.parse(response.body, headers: true)
          assert_includes csv.headers, 'Unknown'
        end
      end
    end
  end
end
