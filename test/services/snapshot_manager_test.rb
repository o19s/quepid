# frozen_string_literal: true

require 'test_helper'

class SnapshotManagerTest < ActiveSupport::TestCase
  cover 'SnapshotManager*'

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

  describe 'options' do
    test 'default to CSV, the Rails logger and no progress output' do
      assert_equal :csv, service.options[:format]
      assert_same Rails.logger, service.logger
      assert_equal Rails.logger, service.options[:logger]
      assert_not service.show_progress?
      assert_same false, service.options[:show_progress]
    end

    test 'accept overrides with string keys and keep the remaining defaults' do
      logger = Logger.new(nil)
      manager = SnapshotManager.new(snapshot, 'format' => :hash, 'show_progress' => true, 'logger' => logger)

      assert_equal :hash, manager.options[:format]
      assert_predicate manager, :show_progress?
      assert_same logger, manager.logger
    end

    test 'a partial override leaves the other defaults alone' do
      manager = SnapshotManager.new(snapshot, show_progress: true)

      assert_equal :csv, manager.options[:format]
      assert_same Rails.logger, manager.logger
      assert_predicate manager, :show_progress?
    end
  end

  describe 'CSV rows' do
    test 'extract_doc_info reads query text, doc id and position from a CSV row' do
      assert_equal({ query_text: 'dog', id: 'doc1', position: '3' }, service.extract_doc_info(%w[dog doc1 3]))
    end

    test 'extract_doc_info deep-symbolizes hash rows' do
      manager = SnapshotManager.new(snapshot, format: :hash)
      row = { 'query_text' => 'dog', 'id' => 'doc1', 'fields' => { 'title' => 'x' } }

      assert_equal({ query_text: 'dog', id: 'doc1', fields: { title: 'x' } }, manager.extract_doc_info(row))
    end

    test 'extract_doc_info passes rows through untouched for any other format' do
      manager = SnapshotManager.new(snapshot, format: :raw)
      row = %w[dog doc1 3]

      assert_same row, manager.extract_doc_info(row)
    end

    test 'csv_to_queries_hash groups rows by query text, keeping row order' do
      rows = [ %w[dog d1 1], %w[cat c1 1], %w[dog d2 2] ]

      assert_equal(
        {
          'dog' => { docs: [ { query_text: 'dog', id: 'd1', position: '1' },
                             { query_text: 'dog', id: 'd2', position: '2' } ] },
          'cat' => { docs: [ { query_text: 'cat', id: 'c1', position: '1' } ] },
        },
        service.csv_to_queries_hash(rows)
      )
    end

    test 'csv_to_queries_hash of nothing is empty' do
      assert_empty service.csv_to_queries_hash([])
    end

    test 'a CSV import creates each query and its ordered docs' do
      rows = [ [ 'csv only query', 'd2', '2' ], [ 'csv only query', 'd1', '1' ] ]

      service.import_queries(service.csv_to_queries_hash(rows))

      query = Query.find_by!(query_text: 'csv only query', case_id: snapshot.case_id)
      docs = snapshot.snapshot_queries.find_by!(query_id: query.id).snapshot_docs.order(:position)
      assert_equal %w[d1 d2], docs.map(&:doc_id)
      assert_equal [ 1, 2 ], docs.map(&:position)
    end
  end

  describe 'document preparation' do
    let(:snapshot_query) { snapshot.snapshot_queries.create!(query: first_query) }

    test 'sorts by numeric position, defaults missing positions to their order and flags to false' do
      docs = [ { id: 'b', position: '2' }, { id: 'a', position: '1' }, { id: 'c' } ]

      built = service.setup_docs_for_query(snapshot_query, docs)

      assert_equal %w[c a b], built.map(&:doc_id)
      assert_equal [ 1, 1, 2 ], built.map(&:position)
      assert_equal [ false, false, false ], built.map(&:rated_only)
      assert_equal [ nil, nil, nil ], built.map(&:fields)
      assert_equal [ snapshot_query.id ], built.map(&:snapshot_query_id).uniq
    end

    test 'numbers several unpositioned docs by their order and honours an explicit rated_only false' do
      built = service.setup_docs_for_query(snapshot_query, [ { id: 'a' }, { id: 'b' }, { id: 'c', rated_only: false } ])

      assert_equal [ 1, 2, 3 ], built.map(&:position).sort
      assert_equal [ false, false, false ], built.map(&:rated_only)
    end

    test 'keeps string explanations as they are and serializes only hashes' do
      built = service.setup_docs_for_query(snapshot_query, [ { id: 'a', explain: 'plain', position: 1 },
                                                             { id: 'b', explain: { x: 1 }, position: 2 } ])

      assert_equal [ 'plain', '{"x":1}' ], built.map(&:explain)
    end

    test 'blank fields are stored as nil and present fields as JSON' do
      built = service.setup_docs_for_query(snapshot_query, [ { id: 'a', fields: {}, position: 1 },
                                                             { id: 'b', fields: { t: 1 }, position: 2 } ])

      assert_nil built.first.fields
      assert_equal '{"t":1}', built.last.fields
    end

    test 'normalize_docs_array symbolizes keys and drops blank entries' do
      docs = [ { 'id' => 'a' }, {}, nil, ActionController::Parameters.new(id: 'b'),
               { 'id' => 'c' }.with_indifferent_access ]

      assert_equal [ { id: 'a' }, { id: 'b' }, { id: 'c' } ], service.normalize_docs_array(docs)
      assert_empty service.normalize_docs_array(nil)
      assert_empty service.normalize_docs_array([])
    end

    test 'normalize_query_result symbolizes keys from hashes and parameters' do
      assert_equal({ score: 1 }, service.normalize_query_result('score' => 1))
      assert_equal({ score: 1 }, service.normalize_query_result(ActionController::Parameters.new(score: 1)))
      assert_empty service.normalize_query_result(nil)
    end
  end

  describe 'writing' do
    test 'write_queries returns the created rows keyed by query id' do
      written = service.write_queries(first_query.id  => { score: 1, docs: [ { id: 'a' } ] },
                                      second_query.id => { score: 2, docs: [] })

      assert_equal [ first_query.id, second_query.id ], written.keys
      assert_equal [ first_query.id, second_query.id ], written.values.map(&:query_id)
      assert_equal([ 1, 2 ], written.values.map { |row| row.score.to_i })
      assert(written.values.all?(&:persisted?))
      assert_not written[first_query.id].association(:snapshot_docs).loaded?
      assert_equal [ 'a' ], written[first_query.id].snapshot_docs.map(&:doc_id)
    end

    test 'write_queries of nothing writes nothing' do
      assert_no_difference [ 'SnapshotQuery.count', 'SnapshotDoc.count' ] do
        assert_empty service.write_queries({})
      end
    end

    test 'write_queries accepts controller parameters' do
      params = ActionController::Parameters.new(first_query.id.to_s => { score: 3, docs: [ { id: 'a' } ] })

      written = service.write_queries(params)

      assert_equal [ first_query.id.to_s ], written.keys.map(&:to_s)
      assert_equal [ 'a' ], SnapshotDoc.where(snapshot_query_id: written.values.map(&:id)).pluck(:doc_id)
    end

    test 'add_docs returns itself and writes each query with its metadata and docs' do
      queries = { first_query.id => { score: 0.5, all_rated: true, number_of_results: 7 } }
      docs = { first_query.id => [ { id: 'a' } ] }

      assert_same service, service.add_docs(docs, queries)

      row = snapshot.snapshot_queries.find_by!(query_id: first_query.id)
      assert_in_delta 0.5, row.score
      assert row.all_rated
      assert_equal 7, row.number_of_results
      assert_equal [ 'a' ], row.snapshot_docs.pluck(:doc_id)
    end

    test 'add_docs accepts parameters and tolerates missing queries and docs' do
      docs = ActionController::Parameters.new(first_query.id.to_s => [ { id: 'a' } ])
      queries = ActionController::Parameters.new(first_query.id.to_s => { score: 4 })

      service.add_docs(docs, queries)
      assert_in_delta 4.0, snapshot.snapshot_queries.find_by!(query_id: first_query.id).score

      assert_no_difference 'SnapshotQuery.count' do
        assert_same service, service.add_docs(nil, {})
      end
      assert_difference 'SnapshotQuery.count', 1 do
        service.add_docs({ second_query.id => [ { id: 'z' } ] }, {})
      end
    end

    test 'fetch_or_create_query reuses an indexed query and creates the rest on the snapshot case' do
      assert_same first_query, service.fetch_or_create_query({ first_query.query_text => first_query },
                                                             first_query.query_text)

      created = nil
      assert_difference 'Query.count', 1 do
        created = service.fetch_or_create_query({}, 'brand new query')
      end
      assert_predicate created, :persisted?
      assert_equal 'brand new query', created.query_text
      assert_equal snapshot.case_id, created.case_id
    end

    test 'fetch_or_create_query creates a query that is missing from an index holding other queries' do
      created = nil
      assert_difference 'Query.count', 1 do
        created = service.fetch_or_create_query({ first_query.query_text => first_query }, 'a different query')
      end
      assert_equal 'a different query', created.query_text
    end

    test 'import_queries returns itself' do
      assert_same service, service.import_queries(first_query.query_text => { docs: [] })
    end
  end
end
