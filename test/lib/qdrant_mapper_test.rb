# frozen_string_literal: true

require 'test_helper'

# Behavior of db/mapper_based_search_engines/qdrant.js, exercised through the same
# V8MapperExecutor that background evaluation (FetchService) runs it with, so a mapper change
# that breaks nightly runs fails here rather than in production.
class QdrantMapperTest < ActiveSupport::TestCase
  let(:mapper_code) { File.read(Rails.root.join('db/mapper_based_search_engines/qdrant.js')) }
  let(:v8_executor) { V8MapperExecutor.new(Rails.root.join('lib/mapper_code_logic.js')) }

  # A Qdrant POST /points/query response: the envelope is fixed across every collection,
  # while everything under "payload" is that collection's own schema.
  let(:response_body) do
    {
      status: 'ok',
      time:   0.002,
      result: {
        points: [
          {
            id:      603,
            version: 3,
            score:   7.43,
            payload: { title: 'The Matrix', overview: 'A hacker learns the truth.' },
          },
          {
            id:      604,
            version: 3,
            score:   5.12,
            payload: { title: 'The Matrix Reloaded', overview: 'Neo returns.' },
          }
        ],
      },
    }.to_json
  end

  # ratedDocsQueryParamsMapper isn't part of V8MapperExecutor's docs/count contract (only the
  # browser calls it, via queriesSvc.buildSearchApiRatedDocsQueryParams), so call it directly.
  def rated_docs_query_params rated_ids, id_field
    context = MiniRacer::Context.new
    context.eval(mapper_code)
    JSON.parse(context.call('ratedDocsQueryParamsMapper', rated_ids, id_field))
  end

  describe 'numberOfResultsMapper' do
    it 'reports the number of points returned' do
      assert_equal 2, v8_executor.extract_number_of_results(mapper_code, response_body)
    end

    it 'reports zero for an empty result set' do
      empty = { status: 'ok', result: { points: [] } }.to_json

      assert_equal 0, v8_executor.extract_number_of_results(mapper_code, empty)
    end
  end

  describe 'docsMapper' do
    let(:docs) { v8_executor.extract_docs(mapper_code, response_body) }

    it 'stringifies the point id so it matches how Quepid keys ratings' do
      assert_equal(%w[603 604], docs.map { |doc| doc['id'] })
    end

    it 'spreads payload keys onto the doc so field_spec can name them directly' do
      assert_equal 'The Matrix', docs.first['title']
      assert_equal 'A hacker learns the truth.', docs.first['overview']
    end

    it "keeps a fields sub-object, which FetchService's snapshot storage reads directly" do
      assert_equal 'The Matrix', docs.first['fields']['title']
      assert_in_delta 7.43, docs.first['fields']['score']
    end

    it 'returns no docs when the collection matched nothing' do
      empty = { status: 'ok', result: { points: [] } }.to_json

      assert_empty v8_executor.extract_docs(mapper_code, empty)
    end

    # The point id is the only thing a has_id filter matches on, so a payload key that
    # happens to be called "id" must not take its place.
    it 'keeps the point id when the payload carries its own id key' do
      shadowing = {
        status: 'ok',
        result: { points: [ { id: 603, score: 1.0, payload: { id: 'tt0133093', title: 'The Matrix' } } ] },
      }.to_json

      assert_equal '603', v8_executor.extract_docs(mapper_code, shadowing).first['id']
    end
  end

  describe 'ratedDocsQueryParamsMapper' do
    it 'filters on the point id with has_id when the case uses the default id field' do
      params = rated_docs_query_params(%w[603 604], 'id')

      assert_equal [ { 'has_id' => [ 603, 604 ] } ], params['filter']['must']
      assert params['with_payload']
    end

    it 'leaves a UUID point id as a string, since Qdrant ids are integers or UUIDs' do
      uuid = '550e8400-e29b-41d4-a716-446655440000'
      params = rated_docs_query_params([ uuid ], 'id')

      assert_equal [ { 'has_id' => [ uuid ] } ], params['filter']['must']
    end

    it 'filters a payload field with match/any when the case repoints its id field' do
      params = rated_docs_query_params(%w[tt0133093 tt0234215], 'imdb_id')

      assert_equal(
        [ { 'key' => 'imdb_id', 'match' => { 'any' => %w[tt0133093 tt0234215] } } ],
        params['filter']['must']
      )
    end

    # A payload value keeps its string form: coercing an "007"-style id to 7 would match nothing.
    it 'does not coerce digit-only payload values to numbers' do
      params = rated_docs_query_params([ '007' ], 'sku')

      assert_equal [ '007' ], params['filter']['must'].first['match']['any']
    end

    # Qdrant defaults limit to 10, so a query with more than ten ratings would lose the rest.
    it 'raises the limit to cover every rated id' do
      params = rated_docs_query_params((1..25).map(&:to_s), 'id')

      assert_equal 25, params['limit']
    end

    it 'never asks for a limit of zero' do
      assert_equal 1, rated_docs_query_params([], 'id')['limit']
    end
  end

  describe 'the shipped default query_params' do
    it 'parses as the JSON body Try#searchapi_args will POST' do
      args = JsonArgParser.parse(MapperBasedSearchEngine.find('qdrant').query_params, {})

      assert_equal '#$query##', args.dig('query', 'nearest', 'text')
      assert_equal 'qdrant/bm25', args.dig('query', 'nearest', 'model')
      # An integer, not "10" - Qdrant's API rejects a string limit.
      assert_equal 10, args['limit']
    end

    it 'ships a test query that works against a collection with no bm25 vector' do
      args = JsonArgParser.parse(MapperBasedSearchEngine.find('qdrant').test_query, {})

      assert_not args.key?('query')
      assert args['with_payload']
    end
  end
end
