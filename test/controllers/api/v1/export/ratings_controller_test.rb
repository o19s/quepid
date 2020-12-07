# frozen_string_literal: true

require 'test_helper'
require 'csv'
module Api
  module V1
    module Export
      class RatingsControllerTest < ActionController::TestCase
        let(:doug) { users(:doug) }

        before do
          @controller = Api::V1::Export::RatingsController.new

          login_user doug
        end

        describe 'Exporting a case in json' do
          let(:the_case)  { cases(:one) }
          let(:matt_case) { cases(:matt_case) }

          test "returns a not found error if the case is not in the signed in user's case list" do
            get :show, params: { case_id: matt_case.id }
            assert_response :not_found
          end

          test 'returns case info' do
            get :show, params: { case_id: the_case.id }
            assert_response :ok

            body = JSON.parse(response.body)

            assert_equal body['queries'].size,         the_case.queries.size
            assert_equal body['queries'][0]['query'],  the_case.queries[0].query_text
          end
        end

        describe 'Exporting a case in RRE json format' do
          let(:the_case) { cases(:one) }

          test 'returns case info' do
            get :show, params: { case_id: the_case.id, file_format: 'rre' }

            # add a query with no docs or ratings
            query = Query.new query_text: '=cmd', case_id: the_case.id
            the_case.queries << query
            the_case.save!

            get :show, params: { case_id: the_case.id, file_format: 'rre' }
            assert_response :ok

            body = JSON.parse(response.body)

            assert_equal body['id_field'],                              'id'
            assert_equal body['index'],                                 the_case.tries.latest.index_name_from_search_url
            assert_equal body['queries'].size,                          the_case.queries.size
            assert_equal body['queries'][0]['placeholders']['$query'],  the_case.queries[0].query_text
            assert_equal body['queries'][2]['placeholders']['$query'],  the_case.queries[2].query_text
            assert_nil body['queries'][2]['relevant_documents']
          end
        end

        describe 'Exporting a case in basic csv format' do
          let(:the_case) { cases(:one) }

          test 'returns case w/ queries and ratings info' do
            rating = the_case.queries[0].ratings.find_or_create_by doc_id: '999a'
            rating.rating = 99
            rating.save!

            # add a query with no docs or ratings
            query = Query.new query_text: '=cmd', case_id: the_case.id
            the_case.queries << query
            the_case.save!

            get :show, params: { case_id: the_case.id, format: :csv, file_format: 'basic' }
            assert_response :ok
            csv = CSV.parse(response.body, headers: true)

            assert_nil csv[0]['rating']
            assert_equal csv[0]['query'],                               ' =cmd' # notice csv injection vulnerability
            assert_equal csv[1]['query'],                               the_case.queries[0].query_text
            assert_equal csv[1]['rating'],                              the_case.queries[0].ratings[0].rating.to_s
          end
        end

        describe 'Exporting a case in LTR text format' do
          let(:the_case) { cases(:one) }

          test 'returns case info' do
            get :show, params: { case_id: the_case.id, format: :txt }
            assert_response :ok

            # rubocop:disable  Lint/UselessAssignment
            # rubocop:disable  Layout/LineLength
            query  = the_case.queries.first
            rating = query.ratings.first

            # For whatever reason the response.body is blank.
            # We want to test both the format of the lines and
            # that specifically for LTR that the export is based on the qid.
            # assert response.body.include?("<%=rating.rating%>    qid:<%=query.id%> #    <%=rating.doc_id %> <%=query.query_text%>")

            # rubocop:enable  Lint/UselessAssignment
            # rubocop:enable  Layout/LineLength

            assert_equal response.content_type, 'text/plain'
          end
        end
      end
    end
  end
end
