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

      describe 'Judge attribution' do
        let(:book) { books(:james_bond_movies) }
        let(:qdp) { query_doc_pairs(:jbm_qdp1) }

        test 'keeps anonymous and different users judgements separate and upserts the same user' do
          qdp.judgements.where(user: [ users(:random), doug ]).find_each(&:destroy!)
          anonymous = qdp.judgements.create!(rating: 2)
          [ users(:random), doug ].each do |judge|
            assert_difference 'qdp.judgements.count', 1 do
              post :create, params: { book_id: book.id, judgement: {
                query_doc_pair_id: qdp.id, user_id: judge.id, rating: 3
              } }
              assert_response :ok
            end
            assert_in_delta 3, qdp.judgements.find_by!(user: judge).rating
          end

          assert_no_difference 'qdp.judgements.count' do
            post :create, params: { book_id: book.id, judgement: {
              query_doc_pair_id: qdp.id, user_id: doug.id, rating: 4
            } }
            assert_response :ok
          end
          assert_in_delta 4, qdp.judgements.find_by!(user: doug).rating
          assert_nil anonymous.reload.user_id
          assert_in_delta 2, anonymous.rating
        end

        test 'creates separate anonymous judgements when user_id is absent or blank' do
          anonymous = qdp.judgements.create!(rating: 2)
          [ nil, '' ].each do |judge_id|
            assert_difference 'qdp.judgements.count', 1 do
              post :create, params: { book_id: book.id, judgement: {
                query_doc_pair_id: qdp.id, user_id: judge_id, rating: 3
              } }
              assert_response :ok
            end
          end
          assert_nil anonymous.reload.user_id
          assert_in_delta 2, anonymous.rating
        end

        test 'round trips the fixture judgements export through the importer' do
          qdp.judgements.create!(unrateable: true, explanation: 'No usable document')
          qdp.judgements.create!(judge_later: true, explanation: 'Review later')
          get :index, params: { book_id: book.id, format: :json }
          assert_response :ok
          payload = response.parsed_body.deep_symbolize_keys
          expected = book.judgements.order(:id).map do |judgement|
            judgement.attributes.slice('rating', 'unrateable', 'judge_later', 'user_id', 'explanation', 'query_doc_pair_id')
          end
          assert_not_empty expected
          book.judgements.each(&:destroy!)

          importer = BookImporter.new(book, doug, payload)
          importer.validate
          assert_empty book.errors
          assert importer.import
          actual = book.judgements.order(:id).map do |judgement|
            judgement.attributes.slice('rating', 'unrateable', 'judge_later', 'user_id', 'explanation', 'query_doc_pair_id')
          end
          sort_rows = ->(rows) { rows.sort_by { |row| [ row['query_doc_pair_id'], row['user_id'].to_i, row['explanation'].to_s ] } }
          assert_equal sort_rows.call(expected), sort_rows.call(actual)
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
