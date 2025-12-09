# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    module Import
      class BooksControllerTest < ActionController::TestCase
        let(:team) { teams(:shared) }
        let(:user) { users(:random) }
        let(:doug) { users(:doug) }
        let(:acase) { cases(:import_ratings_case) }
        let(:query) { queries(:import_ratings_query) }
        let(:book) { books(:james_bond_movies) }

        before do
          @controller = Api::V1::Import::BooksController.new

          login_user user
        end

        describe '#create' do
          test 'alerts when a team_id is not provided' do
            data = {
              name: 'test book',
            }
            assert_raises(ActionController::ParameterMissing) do
              post :create, params: { book: data, format: :json }
            end
          end
          test 'alerts when a user assocated with a judgement does not exist' do
            data = {
              name:               'test book',
              scale:              book.scale,
              scale_with_labels:  book.scale_with_labels,

              selection_strategy: book.selection_strategy.as_json(only: [ :name ]),
              query_doc_pairs:    [
                {
                  query_text: 'dog', doc_id: '123', position: 1,
                  judgements: [
                    {
                      rating:     1.0,
                      unrateable: false,
                      user_email: 'fakeuser@fake.com',
                      user_name:  'Fake',
                    },
                    {
                      rating:     2.0,
                      unrateable: false,
                      user_email: 'random@example.com',
                      user_name:  'Random User',
                    }
                  ]
                },
                { query_text: 'dog', doc_id: '234' },
                { query_text: 'dog', doc_id: '456',
                  judgements: [
                    {
                      rating:     1.0,
                      unrateable: false,
                    }
                  ] }
              ],
            }

            post :create, params: { book: data, team_id: team.id, format: :json }

            assert_response :bad_request

            body = response.parsed_body

            assert_includes body['base'], "User with email 'fakeuser@fake.com' needs to be migrated over first."
            assert_nil Book.find_by(name: 'test book')
          end

          test 'alerts when a selection associated with a book does not exist' do
            data = {
              name:               'test book',
              scale:              book.scale,
              scale_with_labels:  book.scale_with_labels,

              selection_strategy: {
                name: 'fake selection',
              },
              query_doc_pairs:    [],
            }

            post :create, params: { book: data, team_id: team.id, format: :json }

            assert_response :bad_request

            body = response.parsed_body

            assert_includes body['selection_strategy'],
                            "Selection strategy with name 'fake selection' needs to be migrated over first."
            assert_nil Book.find_by(name: 'test book')
          end

         

          test 'creates a new book' do
            data = {
              name:               'test book',
              scale:              book.scale,
              scale_with_labels:  book.scale_with_labels,

              selection_strategy: book.selection_strategy.as_json(only: [ :name ]),
              query_doc_pairs:    [
                {
                  query_text: 'dog', doc_id: '123',
                  judgements: [
                    {
                      rating:     1.0,
                      unrateable: false,
                      user_email: user.email,
                    },
                    {
                      rating:     2.0,
                      unrateable: false,
                      user_email: doug.email,
                    }
                  ]
                },
                { query_text: 'dog', doc_id: '234' },
                { query_text: 'dog', doc_id: '456',
                  judgements: [
                    {
                      rating:     1.0,
                      unrateable: false,
                    }
                  ] }
              ],
            }

            post :create, params: { book: data, team_id: team.id, format: :json }

            assert_response :created

            @book = Book.find_by(name: 'test book')

            assert_not_nil @book

            assert_equal 3, @book.query_doc_pairs.count
            assert_equal 3, @book.judgements.count

            response.parsed_body
          end
        end
      end
    end
  end
end
