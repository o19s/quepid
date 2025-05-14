# frozen_string_literal: true

require 'test_helper'
require 'csv'
module Api
  module V1
    module Export
      module Queries
        class InformationNeedsControllerTest < ActionController::TestCase
          let(:doug) { users(:doug) }

          before do
            @controller = Api::V1::Export::Queries::InformationNeedsController.new

            login_user doug
          end

          describe 'Exporting a case in basic csv format1' do
            let(:the_case) { cases(:one) }

            test 'returns case w/ queries and ratings info' do
              rating = the_case.queries[0].ratings.find_or_create_by doc_id: '999a'
              rating.rating = 99
              rating.save!

              # add a query with no docs or ratings
              query = Query.new query_text: '=cmd', case_id: the_case.id
              the_case.queries << query
              the_case.save!

              # add a query with no docs or ratings
              query_info_need = Query.new query_text: 'star wars', case_id: the_case.id,
                                          information_need: 'Looking for the original blockbuster movie, followed by the most recent big movies.'
              the_case.queries << query_info_need
              the_case.save!

              the_case.reload

              get :show, params: { case_id: the_case.id, format: :csv, file_format: 'basic' }
              assert_response :ok

              csv = CSV.parse(response.body, headers: true)

              assert_equal csv[1]['query'], 'star wars' # notice csv injection vulnerability
              assert_equal csv[1]['information_need'], 'Looking for the original blockbuster movie, followed by the most recent big movies.'
            end
            # rubocop:enable Layout/LineLength
          end
        end
      end
    end
  end
end
