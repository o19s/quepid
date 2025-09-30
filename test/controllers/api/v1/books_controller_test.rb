# frozen_string_literal: true

require 'test_helper'
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

      describe 'Listing books' do
        let(:archived_book) { books(:archived_book) }
        let(:active_book) { books(:james_bond_movies) }

        test 'returns only active books by default' do
          get :index

          assert_response :ok
          body = response.parsed_body

          book_names = body['all_books'].map { |b| b['name'] }
          assert_includes book_names, active_book.name
          assert_not_includes book_names, archived_book.name
        end

        test 'returns only archived books when specified' do
          get :index, params: { archived: true }

          assert_response :ok
          body = response.parsed_body

          book_names = body['all_books'].map { |b| b['name'] }
          assert_not_includes book_names, active_book.name
          assert_includes book_names, archived_book.name
        end

        test 'archived flag works as a string' do
          get :index, params: { archived: 'true' }

          assert_response :ok
          body = response.parsed_body

          book_names = body['all_books'].map { |b| b['name'] }
          assert_not_includes book_names, active_book.name
          assert_includes book_names, archived_book.name
        end

        test 'returns empty array when no books match filter' do
          # Archive all books except the already archived one
          doug.books_involved_with.active.each(&:archive!)

          get :index, params: { archived: false }
          assert_response :ok
          assert_equal [], response.parsed_body['all_books']
        end
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

          assert_equal response.parsed_body['name'], book_name

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

        describe 'when archiving the book' do
          test 'successfully marks book as archived' do
            assert_equal false, the_book.archived

            patch :update, params: { id: the_book.id, book: { archived: true } }
            assert_response :ok

            the_book.reload
            assert_equal true, the_book.archived
          end

          test 'successfully unarchives book' do
            the_book.update(archived: true)
            assert_equal true, the_book.archived

            patch :update, params: { id: the_book.id, book: { archived: false } }
            assert_response :ok

            the_book.reload
            assert_equal false, the_book.archived
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
    end
  end
end
