# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    module Import
      module Queries
        class InformationNeedsControllerTest < ActionController::TestCase
          let(:user)  { users(:random) }
          let(:acase) { cases(:import_ratings_case) }
          let(:query) { queries(:import_ratings_query) }

          before do
            @controller = Api::V1::Import::Queries::InformationNeedsController.new

            login_user user
          end

          # rubocop:disable Layout/LineLength
          describe '#create' do
            test 'updates queries with information needs' do
              acase.queries = []
              acase.save!

              data = {
                case_id: acase.id,
                queries: [
                  {
                    query_text:       'star wars',
                    information_need: 'The original epic star wars movie',
                  },
                  {
                    query_text:       'tough times on hoth',
                    information_need: 'The Empire Strikes back movie',
                  },
                  {
                    query_text:       'tatooine in star wars',
                    information_need: 'Any of the star wars movies mentioning tatooine, plus the mandalorian and story of boba fett',
                  },
                  {
                    query_text:       'star trek',
                    information_need: 'The star trek movies, but definitly not any star wars movies.',
                  }
                ],
              }

              data[:queries].each do |q|
                query = Query.new(query_text: q[:query_text])
                query.case = acase
                query.save!
                q[:query_id] = query.id
                acase.queries << query
              end

              acase.save!

              assert_no_difference 'acase.queries.count' do
                post :create, params: data

                assert_response :ok
              end
            end

            test 'skips over queries where the id or the query text does not exit' do
              acase.queries = []
              acase.save!

              data = {
                case_id: acase.id,
                queries: [
                  {
                    query_text:       'star wars',
                    information_need: 'The original epic star wars movie',
                  },
                  {
                    query_text:       'tough times on hoth',
                    information_need: 'The Empire Strikes back movie',
                  },
                  {
                    query_text:       'tatooine in star wars',
                    information_need: 'Any of the star wars movies mentioning tatooine, plus the mandalorian and story of boba fett',
                  },
                  {
                    query_text:       'star trek',
                    information_need: 'The star trek movies, but definitly not any star wars movies.',
                  }
                ],
              }

              data[:queries].each do |q|
                query = Query.new(query_text: q[:query_text])
                query.case = acase
                query.save!
                q[:query_id] = query.id
                acase.queries << query
              end
              acase.save!

              data[:queries] <<   {
                query_text:       'indiana jones',
                information_need: 'the wonderful adventure movies, and then the tv show.',
              }
              data[:queries] <<   {
                query_id:         '-1',
                query_text:       'boxing movie',
                information_need: 'Rocky series.',
              }

              assert_no_difference 'acase.queries.count' do
                post :create, params: data

                assert_response :ok
              end
            end
          end
          # rubocop:enable Layout/LineLength
        end
      end
    end
  end
end
