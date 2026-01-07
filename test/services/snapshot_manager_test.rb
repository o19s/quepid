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

      assert_not_nil  first_snapshot_query
      assert_not_nil  second_snapshot_query

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

      assert_not_nil  first_snapshot_query
      assert_not_nil  second_snapshot_query

      response_doc = first_snapshot_query.snapshot_docs

      assert_equal 0, response_doc.length # coz they were all nils

      data_doc     = data[second_query.id][:docs]
      response_doc = second_snapshot_query.snapshot_docs

      assert_equal data_doc.length, response_doc.length
    end
  end
end
