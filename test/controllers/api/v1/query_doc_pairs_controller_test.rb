# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    class QueryDocPairsControllerTest < ActionController::TestCase
      let(:doug) { users(:doug) }

      before do
        @controller = Api::V1::QueryDocPairsController.new

        login_user doug
      end

      describe 'Creating a query_doc_pair' do
        let(:random) { users(:random) }
        let(:book) { books(:james_bond_movies) }
        let(:qdp) { query_doc_pairs(:one) }

        before do
          login_user random
        end

        test 'successfully creates a query_doc_pair and adds it to book' do
          count = book.query_doc_pairs.count

          post :create,
               params: { book_id:        book.id,
                         query_doc_pair: {
                           document_fields: qdp.document_fields,
                           position:        qdp.position,
                           query_text:      qdp.query_text,
                           doc_id:          qdp.doc_id,
                         } }

          assert_response :ok

          assert_equal json_response['doc_id'], qdp.doc_id
          assert_equal book.query_doc_pairs.count, count + 1
        end

        test 'requires a query text' do
          post :create,
               params: { book_id:        book.id,
                         query_doc_pair: { document_fields: qdp.document_fields, position: qdp.position,
query_text: '', doc_id: qdp.doc_id } }

          assert_response :bad_request

          body = response.parsed_body
          assert body['query_text'].include? "can't be blank"
        end

        test 'prevents duplicates' do
          assert_difference 'book.query_doc_pairs.count', 1 do
            post :create, params: {
              book_id:        book.id,
              query_doc_pair: {
                document_fields: qdp.document_fields,
                position:        qdp.position,
                query_text:      qdp.query_text,
                doc_id:          qdp.doc_id,
              },
            }
            assert_response :ok

            post :create, params: {
              book_id:        book.id,
              query_doc_pair: {
                document_fields: qdp.document_fields,
                position:        qdp.position,
                query_text:      qdp.query_text,
                doc_id:          qdp.doc_id,
              },
            }
            assert_response :ok
          end
        end
      end
    end
  end
end
