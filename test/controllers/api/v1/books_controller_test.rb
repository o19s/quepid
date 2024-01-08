# frozen_string_literal: true

require 'test_helper'
require 'csv'
module Api
  module V1
    class BooksControllerTest < ActionController::TestCase
      let(:doug) { users(:doug) }
      let(:team) { teams(:shared) }
      let(:multiple_raters) { selection_strategies(:multiple_raters) }
      let(:quepid_default_scorer) { scorers(:quepid_default_scorer) }

      before do
        @controller = Api::V1::BooksController.new

        login_user doug
      end

      describe 'Creating a book' do
        test 'successfully creates a book associated to a team and therefore accessible to user' do
          count     = doug.books_involved_with.count
          book_name = 'test book'

          post :create, params: {
            book: {
              name:                  book_name,
              team_id:               team.id,
              selection_strategy_id: multiple_raters.id,
              scorer_id:             quepid_default_scorer.id,
            },
          }

          assert_response :ok

          assert_equal json_response['name'], book_name

          assert_equal doug.books_involved_with.count, count + 1
        end
      end

      describe 'Updating book' do
        let(:the_book) { books(:james_bond_movies) }

        describe 'when book does not exist' do
          test 'returns not found error' do
            patch :update, params: { id: 'foo', name: 'foo' }
            assert_response :not_found
          end
        end

        describe 'when changing the book name' do
          test 'updates name successfully using PATCH verb' do
            patch :update, params: { id: the_book.id, book: { name: 'New Name' } }
            assert_response :ok

            the_book.reload
            assert_equal the_book.name, 'New Name'
          end
        end
      end
      describe 'Deleting a book' do
        describe 'when it is the last/only case' do
          let(:doug)      { users(:doug) }
          let(:the_book)  { books(:james_bond_movies) }

          before do
            login_user doug
          end

          test 'is perfectly okay' do
            delete :destroy, params: { id: the_book.id }
            assert_response :no_content

            assert_not_includes doug.books_involved_with, the_book
          end
        end
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
          # assert_equal body['query_doc_pairs'][0]['query'], book.query_doc_pairs[0].query_text
          # assert_nil body['query_doc_pairs'][0]['document_fields']
        end
      end

      describe 'Exporting a book in basic csv format' do
        let(:book)        { books(:james_bond_movies) }
        let(:judgement)   { judgements(:jbm_qdp10_judgement) }
        let(:doug)        { users(:doug) }
        let(:random_user) { users(:random) }

        test 'returns book w/ query doc pairs and judgement info' do
          get :show, params: { id: book.id, format: :csv }

          assert_response :ok
          csv = CSV.parse(response.body, headers: true)
          assert_equal 'Best Bond Ever', csv[0]['query']
          assert_equal 'GeorgeLazenby', csv[0]['docid']
          assert_equal '3.0', csv[3]['Doug Turnbull']

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
