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
                           options:         qdp.options,
                         } }

          assert_response :ok

          assert_equal book.query_doc_pairs.count, count + 1

          assert_equal response.parsed_body['doc_id'], qdp.doc_id
          assert_equal response.parsed_body['options']['special_boost'].to_f, qdp.options['special_boost']
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

      describe 'Fetching a query doc to be judged' do
        let(:random) { users(:random) }
        let(:book) { books(:james_bond_movies) }
        let(:qdp) { query_doc_pairs(:one) }

        test 'it returns a random query doc pair that has not been judged' do
          # We are not actually testing the randomization logic, just the api

          get :to_be_judged, params: { book_id: book.id, judge_id: random.id }
          assert_response :ok

          body = response.parsed_body

          assert body.to_s.include?('query_text')
        end

        test 'it handles things nicely when no more to be judged' do
          # go ahead and judge everything by the random user.
          already_judged_qdps = book.judgements.where(user_id: random.id).collect(&:query_doc_pair)
          qdps_to_judge = book.query_doc_pairs - already_judged_qdps
          qdps_to_judge.each do |qdp|
            qdp.judgements.create! rating: 1, user_id: random.id
          end

          get :to_be_judged, params: { book_id: book.id, judge_id: random.id }
          assert_response :no_content
        end
      end
    end
  end
end
