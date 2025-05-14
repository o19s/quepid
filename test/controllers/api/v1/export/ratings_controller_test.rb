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

            body = response.parsed_body

            assert_equal body['queries'].size,         the_case.queries.size
            assert_equal body['queries'][0]['query'],  the_case.queries[0].query_text
          end
        end

        describe 'Exporting a case in RRE json format' do
          let(:the_case) { cases(:queries_case) }

          test 'returns case info' do
            get :show, params: { case_id: the_case.id, file_format: 'rre' }

            # add a query with no docs or ratings
            query = Query.new query_text: '=cmd', case_id: the_case.id
            the_case.queries << query
            the_case.save!

            the_case.reload

            get :show, params: { case_id: the_case.id, file_format: 'rre' }
            assert_response :ok

            body = response.parsed_body

            assert_equal body['id_field'],                              'id'
            assert_equal body['index'],                                 the_case.tries.latest.index_name_from_search_url
            assert_equal body['queries'].size,                          the_case.queries.size
            assert_equal body['queries'][1]['placeholders']['$query'],  the_case.queries[1].query_text
            assert_equal body['queries'][2]['placeholders']['$query'],  the_case.queries[2].query_text
            assert_not_nil body['queries'][2]['relevant_documents']

            # somewhat verbose RRE format for describing ratings.
            expected_relevant_docs = {
              docb: {
                gain: 1,
              },
              doca: {
                gain: 3,
              },
            }

            assert_equal expected_relevant_docs, body['queries'][2]['relevant_documents'].deep_symbolize_keys
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

          test 'returns case w/ queries but no ratings in explicit csv compatible format' do
            the_case.queries[0].ratings.destroy
            get :show, params: { case_id: the_case.id, format: :csv, file_format: 'basic' }
            assert_response :ok

            expected_csv = "query,docid,rating\n" \
                           "two,,\n" \
                           "one,,\n"
            assert_equal response.body, expected_csv

            csv = CSV.parse(response.body, headers: true)
            assert_nil csv[0]['rating']
            assert_equal csv[0]['query'], the_case.queries[0].query_text
          end

          test 'CSV export properly deals with a comma in the query_text' do
            the_case.queries[0].query_text = 'I like, commas!'
            the_case.queries[0].save
            get :show, params: { case_id: the_case.id, format: :csv, file_format: 'basic' }
            assert_response :ok

            expected_csv = "query,docid,rating\n" \
                           "\"I like, commas!\",,\n" \
                           "one,,\n"
            assert_equal response.body, expected_csv

            csv = CSV.parse(response.body, headers: true)
            assert_equal csv[0]['query'], the_case.queries[0].query_text
          end

          test 'CSV response should not have a trailing line feed' do
            # See https://github.com/o19s/quepid/issues/354
            lines_expected = the_case.queries.count + 1 # include csv header line!

            get :show, params: { case_id: the_case.id, format: :csv, file_format: 'basic' }

            raw_text = response.body
            assert_equal lines_expected, raw_text.lines.size
          end

          test 'adds space when cell begins with =' do
            assert_equal ' =abc', @controller.make_csv_safe('=abc')
          end

          test 'adds space when cell begins with +' do
            assert_equal ' +abc', @controller.make_csv_safe('+abc')
          end

          test 'adds space when cell begins with -' do
            assert_equal ' -abc', @controller.make_csv_safe('-abc')
          end

          test 'adds space when cell begins with @' do
            assert_equal ' @abc', @controller.make_csv_safe('@abc')
          end

          test 'other strings unchanged' do
            assert_equal 'ab=@c', @controller.make_csv_safe('ab=@c')
          end
        end

        describe 'Exporting a snapshot of a case in basic csv format' do
          let(:the_user)      { users(:random) }
          let(:the_case)      { cases(:snapshot_case) }
          let(:the_snapshot)  { snapshots(:a_snapshot) }

          test 'CSV response doesnt have a trailing line feed' do
            # See https://github.com/o19s/quepid/issues/354
            lines_expected = the_snapshot.snapshot_queries.map do |sq|
              sq.snapshot_docs.count
            end.sum + 1 # include csv header line!
            login_user the_user
            get :show,
                params: { case_id: the_case.id, snapshot_id: the_snapshot.id, format: :csv,
file_format: 'basic_snapshot' }

            raw_text = response.body
            assert_equal lines_expected, raw_text.lines.size
          end
        end

        describe 'Exporting a case in LTR text format' do
          let(:the_case) { cases(:one) }

          test 'returns case info' do
            get :show, params: { case_id: the_case.id, format: :txt, file_format: 'ltr' }
            assert_response :ok

            # rubocop:disable  Lint/UselessAssignment
            query  = the_case.queries.first
            rating = query.ratings.first

            # For whatever reason the response.body is blank.
            # We want to test both the format of the lines and
            # that specifically for LTR that the export is based on the qid.
            # assert response.body.include?("<%=rating.rating%>    qid:<%=query.id%> #    <%=rating.doc_id %> <%=query.query_text%>")

            # rubocop:enable  Lint/UselessAssignment

            assert_equal response.content_type, 'text/plain; charset=utf-8'
          end
        end
      end
    end
  end
end
