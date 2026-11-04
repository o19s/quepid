# frozen_string_literal: true

require 'test_helper'
require 'thor'
load Rails.root.join('lib/tasks/sample_data.thor').to_s

class SampleDataE2eFixtureTest < ActiveSupport::TestCase
  let(:user) { users(:random) }

  def build_source_case
    source = user.cases.create! case_name: '10s of Queries'
    source.tries.create! try_number: 1, query_params: 'q=#$query##', field_spec: 'id:id, title:title'
    query = source.queries.create! query_text: 'duck'
    query.ratings.create! doc_id: 'mallard-001', rating: 3
    query.ratings.create! doc_id: 'teal-001', rating: 1
    source
  end

  test 'e2e_fixture creates case 219 backed by a static snapshot endpoint' do
    Case.where(id: 219).destroy_all
    build_source_case
    assert_nil Case.find_by(id: 219)

    capture_io { SampleData.start([ 'e2e_fixture' ]) }

    fixture = Case.find 219
    assert_equal 'E2E Static Fixture (10s of Queries)', fixture.case_name
    assert_equal [ 'duck' ], fixture.queries.map(&:query_text)

    snapshot = fixture.snapshots.first
    assert_equal %w[mallard-001 teal-001], snapshot.snapshot_queries.first.snapshot_docs.order(:position).map(&:doc_id)

    endpoint = fixture.tries.latest.search_endpoint
    assert_equal 'static', endpoint.search_engine
    assert_equal "http://localhost:3000/api/cases/219/snapshots/#{snapshot.id}/search", endpoint.endpoint_url
  end

  test 'e2e_fixture leaves an existing case 219 alone' do
    Case.where(id: 219).destroy_all
    build_source_case

    capture_io { SampleData.start([ 'e2e_fixture' ]) }
    assert_no_difference 'Case.count' do
      capture_io { SampleData.start([ 'e2e_fixture' ]) }
    end
  end
end
