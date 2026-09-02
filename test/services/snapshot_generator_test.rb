# frozen_string_literal: true

require 'test_helper'

class SnapshotGeneratorTest < ActiveSupport::TestCase
  let(:solr_url) { 'http://solr.quepidapp.com:8983/solr/statedecoded/select' }
  let(:default_options) do
    {
      field:         'text',
      id:            'id',
      logger:        Logger.new(IO::NULL),
      number:        2,
      query:         '*:*',
      rows:          2,
      show_progress: false,
    }
  end
  let(:generator) { SnapshotGenerator.new solr_url, default_options }

  setup do
    body = File.read(Rails.root.join('test/fixtures/files/solr_statedecoded_response.json'))

    # Every request SnapshotGenerator's underlying DocGenerator makes (whatever
    # random query text it ends up sending) returns the same fixture response.
    stub_request(:get, /solr\.quepidapp\.com/)
      .to_return(status: 200, body: body)
  end

  describe '#initialize' do
    test 'merges given options with the defaults' do
      assert_equal 'text', generator.options[:field]
      assert_equal 2, generator.options[:number]
    end

    test 'defaults show_progress to false' do
      generator = SnapshotGenerator.new solr_url

      assert_not generator.show_progress?
    end
  end

  describe '#show_progress?' do
    test 'reflects the show_progress option' do
      generator = SnapshotGenerator.new solr_url, default_options.merge(show_progress: true)

      assert_predicate generator, :show_progress?
    end
  end

  describe '#generate_snapshot' do
    test 'returns docs with a position assigned per query' do
      docs = generator.generate_snapshot

      assert_not_empty docs

      docs.each do |doc|
        assert doc.key?(:query_text)
        assert doc.key?(:doc_id)
        assert doc.key?(:position)
      end
    end

    test 'positions restart at 1 for each distinct query' do
      docs = generator.generate_snapshot

      docs.group_by { |doc| doc[:query_text] }.each_value do |docs_for_query|
        positions = docs_for_query.map { |doc| doc[:position] }

        assert_equal 1, docs_for_query.first[:position]
        assert_equal (1..docs_for_query.length).to_a, positions
      end
    end
  end

  describe '#position_docs' do
    test 'assigns sequential positions within each query group' do
      docs = [
        { query_text: 'dog', doc_id: 'a' },
        { query_text: 'dog', doc_id: 'b' },
        { query_text: 'cat', doc_id: 'c' }
      ]

      positioned = generator.position_docs docs

      dog_positions = positioned.select { |doc| 'dog' == doc[:query_text] }.map { |doc| doc[:position] }
      cat_positions = positioned.select { |doc| 'cat' == doc[:query_text] }.map { |doc| doc[:position] }

      assert_equal [ 1, 2 ], dog_positions
      assert_equal [ 1 ], cat_positions
    end
  end
end
