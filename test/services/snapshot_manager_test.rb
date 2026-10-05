# frozen_string_literal: true

require 'test_helper'

class SnapshotManagerTest < ActiveSupport::TestCase
  let(:snapshot)      { snapshots(:empty_snapshot) }
  let(:first_query)   { queries(:a_query) }
  let(:second_query)  { queries(:b_query) }

  let(:service)       { SnapshotManager.new(snapshot) }

  describe 'Adds docs to a snapshot' do
    test 'adds snapshot to case' do
      sample_fields = { title: 'some title', 'thumb:product_image': 'http://example.com/image.png' }

      data = {
        docs:    {
          first_query.id  => [
            { id: 'doc1', explain: '1', fields: sample_fields },
            { id: 'doc2', explain: '2', fields: sample_fields }
          ],
          second_query.id => [
            { id: 'doc3', explain: '3', fields: sample_fields },
            { id: 'doc4', explain: '4', fields: sample_fields }
          ],
        },
        queries: {
          first_query.id  => {
            score:             0.87,
            all_rated:         true,
            number_of_results: 42,
          },
          second_query.id => {
            score:             0.45,
            all_rated:         false,
            number_of_results: nil,
          },
        },
      }

      assert_difference 'snapshot.snapshot_queries.count', 2 do
        service.add_docs data[:docs], data[:queries]

        # This is needed or else we get wrong numbers
        snapshot.reload
        snapshot_queries = snapshot.snapshot_queries

        assert_equal snapshot_queries.length, data[:docs].length

        first_snapshot_query  = snapshot_queries.where(query_id: first_query.id).first
        second_snapshot_query = snapshot_queries.where(query_id: second_query.id).first

        assert_not_nil  first_snapshot_query
        assert_equal    first_snapshot_query.query_id, first_query.id
        assert_in_delta(first_snapshot_query.score, 0.87)
        assert first_snapshot_query.all_rated
        assert_equal 42, first_snapshot_query.number_of_results

        assert_not_nil  second_snapshot_query
        assert_equal    second_snapshot_query.query_id, second_query.id
        assert_in_delta(second_snapshot_query.score, 0.45)
        assert_not second_snapshot_query.all_rated
        assert_nil      second_snapshot_query.number_of_results

        data_doc      = data[:docs][first_query.id][0]
        response_doc  = first_snapshot_query.snapshot_docs[0]

        assert_equal data_doc[:id],       response_doc.doc_id
        assert_equal data_doc[:explain],  response_doc.explain
        assert_equal 1,                   response_doc.position
        assert_equal sample_fields.to_json, response_doc.fields

        data_doc      = data[:docs][second_query.id][0]
        response_doc  = second_snapshot_query.snapshot_docs[0]

        assert_equal data_doc[:id],       response_doc.doc_id
        assert_equal data_doc[:explain],  response_doc.explain
        assert_equal 1,                   response_doc.position
        assert_equal sample_fields.to_json, response_doc.fields
      end
    end
  end

  test 'normalizes snapshot documents and serializes structured explanations once' do
    snapshot_query = snapshot.snapshot_queries.create!(query: first_query)
    explanation = { match: true, value: 13.647848 }
    docs = [
      ActionController::Parameters.new(id: 'hash', explain: explanation, position: 2, fields: { title: [ 'milk' ] }),
      { id: 'json', explain: explanation.to_json, position: 1 }.with_indifferent_access,
      { id: 'nil', explain: nil, rated_only: true },
      nil
    ]

    results = service.setup_docs_for_query(snapshot_query, docs)
    SnapshotDoc.insert_all(results.map { |doc| doc.attributes.except('id') })
    persisted = snapshot_query.reload.snapshot_docs.index_by(&:doc_id)

    assert_equal 3, persisted.size
    assert_equal explanation.stringify_keys, JSON.parse(persisted['hash'].explain)
    assert_equal explanation.to_json, persisted['json'].explain
    assert_nil persisted['nil'].explain
    assert_equal({ 'title' => [ 'milk' ] }, JSON.parse(persisted['hash'].fields))
    assert_equal 2, persisted['hash'].position
    assert_equal 1, persisted['json'].position
    assert persisted['nil'].rated_only
    assert_empty service.setup_docs_for_query(snapshot_query, [])
    assert_empty service.setup_docs_for_query(nil, docs)
  end

  test 'shared writer normalizes metadata and preserves input documents' do
    doc = { 'id' => 'doc1', 'explain' => { 'value' => 1.5 } }.freeze
    result = {
      'score' => '--', 'all_rated' => false, 'number_of_results' => 12,
      'response_status' => 503, 'error' => 'unavailable', 'docs' => [ doc ]
    }

    service.write_queries(first_query.id => result)

    persisted = snapshot.snapshot_queries.find_by!(query_id: first_query.id)
    assert_nil persisted.score
    assert_not persisted.all_rated
    assert_equal 12, persisted.number_of_results
    assert_equal 503, persisted.response_status
    assert_equal 'unavailable', persisted.error
    assert_equal({ 'value' => 1.5 }, JSON.parse(persisted.snapshot_docs.first.explain))
    assert_equal '--', result['score']
    assert doc.key?('id')
  end

  test 'shared writer rolls back query rows when document normalization fails' do
    assert_no_difference 'SnapshotQuery.count' do
      assert_raises NoMethodError do
        service.write_queries(first_query.id => { docs: [ 123 ] })
      end
    end
  end

  test 'repeated writes append independent rows without inheriting metadata' do
    first = service.write_queries(first_query.id => {
      score: 0.75, all_rated: true, response_status: 200, docs: [ { id: 'original' } ]
    }).fetch(first_query.id)

    second = nil
    assert_difference 'snapshot.snapshot_queries.count' do
      second = service.write_queries(first_query.id => {
        docs: [ { id: 'repeated' } ],
      }).fetch(first_query.id)
    end

    assert_not_equal first.id, second.id
    assert_equal [ 'original' ], first.reload.snapshot_docs.pluck(:doc_id)
    assert_equal [ 'repeated' ], second.snapshot_docs.map(&:doc_id)
    assert_in_delta 0.75, first.score
    assert_nil second.score
    assert_nil second.all_rated
    assert_nil second.response_status
  end

  test 'imports normalize score metadata through the shared writer' do
    service.import_queries(first_query.query_text => {
      score: '--', all_rated: true, number_of_results: 24, docs: []
    })

    persisted = snapshot.snapshot_queries.find_by!(query_id: first_query.id)
    assert_nil persisted.score
    assert persisted.all_rated
    assert_equal 24, persisted.number_of_results
  end

  describe 'Import queries' do
    test 'creates queries if they do not already exist' do
      data = {
        'dog' => {
          docs: [
            { id: 'doc1', explain: '1', position: 1 },
            { id: 'doc2', explain: '2', position: 2 }
          ],
        },
        'cat' => {
          docs: [
            { id: 'doc3', explain: '3', position: 2 },
            { id: 'doc4', explain: '4', position: 1 }
          ],
        },
      }

      assert_difference 'Query.count', 2 do
        service.import_queries data

        # This is needed or else we get wrong numbers
        snapshot.reload
        queries = snapshot.snapshot_queries

        assert_equal queries.length, data.length

        first_query   = Query.where(query_text: 'dog', case_id: snapshot.case_id).first
        second_query  = Query.where(query_text: 'cat', case_id: snapshot.case_id).first

        first_snapshot_query  = queries.where(query_id: first_query.id).first
        second_snapshot_query = queries.where(query_id: second_query.id).first

        assert_not_nil  first_snapshot_query
        assert_equal    first_snapshot_query.query_id, first_query.id

        assert_not_nil  second_snapshot_query
        assert_equal    second_snapshot_query.query_id, second_query.id

        data_doc      = data[first_query.id][:docs][0]
        response_doc  = first_snapshot_query.snapshot_docs[0]

        assert_equal data_doc[:id],       response_doc.doc_id
        assert_equal data_doc[:explain],  response_doc.explain
        assert_equal data_doc[:position], response_doc.position
        assert_equal 1,                   response_doc.position

        data_doc      = data[second_query.id][:docs][0]
        response_doc  = second_snapshot_query.snapshot_docs[1]

        assert_equal data_doc[:id],       response_doc.doc_id
        assert_equal data_doc[:explain],  response_doc.explain
        assert_equal data_doc[:position], response_doc.position
        assert_equal 2,                   response_doc.position
      end
    end

    test 'does not create queries if they already exist' do
      data = {
        first_query.query_text  => {
          docs: [
            { id: 'doc1', explain: '1', position: 1 },
            { id: 'doc2', explain: '2', position: 2 }
          ],
        },
        second_query.query_text => {
          docs: [
            { id: 'doc3', explain: '3', position: 2 },
            { id: 'doc4', explain: '4', position: 1 }
          ],
        },
      }

      assert_no_difference 'Query.count' do
        service.import_queries data

        # This is needed or else we get wrong numbers
        snapshot.reload
        queries = snapshot.snapshot_queries

        assert_equal queries.length, data.length

        first_snapshot_query  = queries.where(query_id: first_query.id).first
        second_snapshot_query = queries.where(query_id: second_query.id).first

        assert_not_nil  first_snapshot_query
        assert_equal    first_snapshot_query.query_id, first_query.id

        assert_not_nil  second_snapshot_query
        assert_equal    second_snapshot_query.query_id, second_query.id

        data_doc      = data[first_query.id][:docs][0]
        response_doc  = first_snapshot_query.snapshot_docs[0]

        assert_equal data_doc[:id],       response_doc.doc_id
        assert_equal data_doc[:explain],  response_doc.explain
        assert_equal data_doc[:position], response_doc.position
        assert_equal 1,                   response_doc.position

        data_doc      = data[second_query.id][:docs][0]
        response_doc  = second_snapshot_query.snapshot_docs[1]

        assert_equal data_doc[:id],       response_doc.doc_id
        assert_equal data_doc[:explain],  response_doc.explain
        assert_equal data_doc[:position], response_doc.position
        assert_equal 2,                   response_doc.position
      end
    end

    test 'handles query data with empty docs' do
      data = {
        first_query.query_text  => {
          docs: [],
        },
        second_query.query_text => {
          docs: [],
        },
      }

      service.import_queries data

      # This is needed or else we get wrong numbers
      snapshot.reload
      queries = snapshot.snapshot_queries

      assert_equal queries.length, data.length

      first_snapshot_query  = queries.where(query_id: first_query.id).first
      second_snapshot_query = queries.where(query_id: second_query.id).first

      assert_not_nil first_snapshot_query
      assert_not_nil second_snapshot_query

      data_doc     = data[first_query.id][:docs]
      response_doc = first_snapshot_query.snapshot_docs

      assert_equal data_doc.length, response_doc.length

      data_doc     = data[second_query.id][:docs]
      response_doc = second_snapshot_query.snapshot_docs

      assert_equal data_doc.length, response_doc.length
    end

    test 'handles query data with array of nil docs' do
      data = {
        first_query.query_text  => {
          docs: [ nil, nil ],
        },
        second_query.query_text => {
          docs: [
            { id: 'doc3', explain: '3', position: 2 },
            { id: 'doc4', explain: '4', position: 1 }
          ],
        },
      }

      service.import_queries data

      # This is needed or else we get wrong numbers
      snapshot.reload
      queries = snapshot.snapshot_queries

      assert_equal queries.length, data.length

      first_snapshot_query  = queries.where(query_id: first_query.id).first
      second_snapshot_query = queries.where(query_id: second_query.id).first

      assert_not_nil first_snapshot_query
      assert_not_nil second_snapshot_query

      response_doc = first_snapshot_query.snapshot_docs

      assert_equal 0, response_doc.length # coz they were all nils

      data_doc     = data[second_query.id][:docs]
      response_doc = second_snapshot_query.snapshot_docs

      assert_equal data_doc.length, response_doc.length
    end
  end
end
