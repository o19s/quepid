# frozen_string_literal: true

require 'test_helper'

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
    end
  end
end
