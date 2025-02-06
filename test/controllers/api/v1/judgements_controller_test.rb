# frozen_string_literal: true

require 'test_helper'
require 'csv'
module Api
  module V1
    class JudgementsControllerTest < ActionController::TestCase
      let(:doug) { users(:doug) }

      before do
        @controller = Api::V1::JudgementsController.new

        login_user doug
      end

      describe 'Creating a judgement' do
        let(:random) { users(:random) }
        let(:book) { books(:james_bond_movies) }
        let(:qdp) { query_doc_pairs(:one) }

        before do
          login_user random
        end

        test 'on an existing query_doc_pair' do
          assert_difference 'qdp.judgements.count', 1 do
            post :create, params: {
              book_id:   book.id,
              judgement: {
                rating:            1,
                query_doc_pair_id: qdp.id,
                explanation:       'I think simple things are best and this is simple',
              },
            }
            assert_response :ok
          end
        end
      end

      describe 'Listing judgements for a book in basic csv format' do
        let(:book)        { books(:james_bond_movies) }
        let(:judgement)   { judgements(:jbm_qdp10_judgement) }
        let(:doug)        { users(:doug) }
        let(:random_user) { users(:random) }

        test 'returns book w/ query doc pairs and judgement info' do
          get :index, params: { book_id: book.id, format: :csv }

          assert_response :ok
          csv = CSV.parse(response.body, headers: true)

          assert_not_nil csv[0]['query']
          assert_not_nil csv[0]['docid']

          assert_not_includes csv.headers, 'Unknown'
        end

        test 'handles a rating that is not associated with a user, and adds Unknown' do
          judgement.user = nil
          judgement.save!
          get :index, params: { book_id: book.id, format: :csv }

          assert_response :ok
          csv = CSV.parse(response.body, headers: true)
          assert_includes csv.headers, 'Anonymous'
        end
      end
    end
  end
end
