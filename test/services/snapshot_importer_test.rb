# frozen_string_literal: true

require 'test_helper'

class SnapshotImporterTest < ActiveSupport::TestCase
  let(:acase)     { cases(:snapshot_case) }
  let(:importer)  { SnapshotImporter.new acase }

  describe '#import_snapshots' do
    test 'creates a snapshot for each entry given' do
      created_at = DateTime.now.in_time_zone

      data = [
        {
          name:       'Snapshot 1',
          created_at: created_at,
          queries:    {
            'dog' => { docs: [ { id: 'doc1', explain: '1', position: 1 } ] },
          },
        },
        {
          name:       'Snapshot 2',
          created_at: created_at,
          queries:    {
            'cat' => { docs: [ { id: 'doc2', explain: '2', position: 1 } ] },
          },
        }
      ]

      assert_difference 'acase.snapshots.count', 2 do
        result = importer.import_snapshots data

        assert_equal 2, result.length
        assert_equal 'Snapshot 1', result.first.name
        assert_equal 'Snapshot 2', result.second.name
      end
    end

    test 'attaches the returned snapshots to the case' do
      data = [
        {
          name:       'A snapshot',
          created_at: DateTime.now.in_time_zone,
          queries:    {
            'dog' => { docs: [ { id: 'doc1', explain: '1', position: 1 } ] },
          },
        }
      ]

      result = importer.import_snapshots(data)

      assert_equal acase.id, result.first.case_id
    end

    test 'creates queries and docs for each snapshot via the snapshot manager' do
      data = [
        {
          name:       'A snapshot',
          created_at: DateTime.now.in_time_zone,
          queries:    {
            'dog' => {
              docs: [
                { id: 'doc1', explain: '1', position: 1 },
                { id: 'doc2', explain: '2', position: 2 }
              ],
            },
            'cat' => {
              docs: [
                { id: 'doc3', explain: '3', position: 1 }
              ],
            },
          },
        }
      ]

      snapshot = importer.import_snapshots(data).first

      assert_equal 2, snapshot.snapshot_queries.count
      assert_equal 3, snapshot.snapshot_docs.count

      dog_query = acase.queries.find_by(query_text: 'dog')
      assert_not_nil dog_query
    end

    test 'returns an empty array when given no snapshots' do
      result = importer.import_snapshots([])

      assert_empty result
    end
  end
end
