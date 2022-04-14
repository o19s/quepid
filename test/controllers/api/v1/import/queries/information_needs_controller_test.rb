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

              queries = [
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
              ]

              queries.each do |q|
                query = Query.new(query_text: q[:query_text])
                query.case = acase
                query.save!
                q[:query_id] = query.id
                acase.queries << query
              end

              csv_text = 'query_id,query,information_need\n'
              queries.each do |q|
                csv_text = "#{q[:query_id]}, #{q[:query_text]}, #{q[:information_need]}\n"
              end

              acase.save!

              assert_no_difference 'acase.queries.count' do
                post :create, params: { case_id: acase.id, csv_text: csv_text }

                assert_response :ok
              end
            end

            test 'handles double quotes around comma in the text' do
              acase.queries = []
              acase.save!

              queries = [
                {
                  query_text:       'pandas',
                  information_need: '"Looking for eats, shoots, and leaves."',
                }
              ]

              queries.each do |q|
                query = Query.new(query_text: q[:query_text])
                query.case = acase
                query.save!
                q[:query_id] = query.id
                acase.queries << query
              end

              csv_text = 'query_id,query,information_need\n'
              queries.each do |q|
                csv_text = "#{q[:query_id]}, #{q[:query_text]}, #{q[:information_need]}\n"
              end

              acase.save!

              assert_no_difference 'acase.queries.count' do
                post :create, params: { case_id: acase.id, csv_text: csv_text }

                assert_response :ok
              end
            end

            test 'skips over queries where the id or the query text does not exit' do
              acase.queries = []
              acase.save!

              queries = [
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
              ]

              queries.each do |q|
                query = Query.new(query_text: q[:query_text])
                query.case = acase
                query.save!
                q[:query_id] = query.id
                acase.queries << query
              end
              acase.save!

              queries << {
                query_text:       'indiana jones',
                information_need: 'the wonderful adventure movies, and then the tv show.',
              }
              queries << {
                query_id:         '-1',
                query_text:       'boxing movie',
                information_need: 'Rocky series.',
              }

              csv_text = 'query_id,query,information_need\n'
              queries.each do |q|
                csv_text = "#{q[:query_id]}, #{q[:query_text]}, #{q[:information_need]}\n"
              end

              assert_no_difference 'acase.queries.count' do
                post :create, params: { case_id: acase.id, csv_text: csv_text }

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
