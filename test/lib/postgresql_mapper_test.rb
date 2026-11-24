# frozen_string_literal: true

require 'test_helper'

# Behavior of db/mapper_based_search_engines/postgresql.js, run through the V8MapperExecutor
# that FetchService uses, against the { rows: [...] } body PostgresSearchService answers with.
class PostgresqlMapperTest < ActiveSupport::TestCase
  let(:mapper_code) { File.read(Rails.root.join('db/mapper_based_search_engines/postgresql.js')) }
  let(:v8_executor) { V8MapperExecutor.new(Rails.root.join('lib/mapper_code_logic.js')) }
  let(:response_body) do
    { rows: [
      { id: 603, title: 'The Matrix', overview: 'A hacker learns the truth.', score: 0.61 },
      { id: 604, title: 'The Matrix Reloaded', overview: 'Neo returns.', score: 0.42 }
    ] }.to_json
  end

  describe 'numberOfResultsMapper' do
    it 'reports the number of rows returned' do
      assert_equal 2, v8_executor.extract_number_of_results(mapper_code, response_body)
    end
  end

  describe 'docsMapper' do
    let(:docs) { v8_executor.extract_docs(mapper_code, response_body) }

    it 'stringifies the id column so it matches how Quepid keys ratings' do
      assert_equal(%w[603 604], docs.map { |doc| doc['id'] })
    end

    it 'spreads columns onto the doc and keeps a fields sub-object' do
      assert_equal 'The Matrix', docs.first['title']
      assert_equal 'The Matrix', docs.first['fields']['title']
      assert_in_delta 0.61, docs.first['fields']['score']
    end

    it 'returns no docs when no rows matched' do
      assert_empty v8_executor.extract_docs(mapper_code, { rows: [] }.to_json)
    end
  end

  describe 'requestArgsMapper' do
    it 'keeps an explicit limit' do
      args = v8_executor.apply_request_args_mapper(mapper_code, { 'sql' => 'SELECT 1', 'limit' => 10 }, 37)

      assert_equal 10, args['limit']
    end

    it 'adds the number of rows as a numeric limit' do
      args = v8_executor.apply_request_args_mapper(mapper_code, { 'sql' => 'SELECT 1' }, 5)

      assert_equal 5, args['limit']
    end
  end
end
