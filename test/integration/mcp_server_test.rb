# frozen_string_literal: true

require 'test_helper'

# Drives the MCP endpoint (app/mcp/) as a Rack app, so it runs whether or not
# MCP_SERVER mounted it in config/routes.rb.
class McpServerTest < ActionDispatch::IntegrationTest
  let(:doug) { users(:doug) }
  let(:matt) { users(:matt) }

  def setup
    @enabled = Rails.application.config.x.mcp_server_enabled
    Rails.application.config.x.mcp_server_enabled = true
  end

  def teardown
    Rails.application.config.x.mcp_server_enabled = @enabled
  end

  def token_for user
    user.api_keys.create!(token: SecureRandom.hex).token_digest
  end

  def mcp method, params = {}, token: nil
    headers = {
      'CONTENT_TYPE'    => 'application/json',
      'HTTP_ACCEPT'     => 'application/json, text/event-stream',
      # What a real client sends; Ahoy's bot detection would drop its events.
      'HTTP_USER_AGENT' => 'node',
    }
    headers['HTTP_AUTHORIZATION'] = "Bearer #{token}" if token
    body = { jsonrpc: '2.0', id: 1, method: method, params: params }.to_json
    Rack::MockRequest.new(RorMcp.endpoint).post('/', headers.merge(input: body))
  end

  def call_tool name, arguments, token:
    response = mcp('tools/call', { name: name, arguments: arguments }, token: token)

    assert_equal 200, response.status
    JSON.parse(response.body)['result']
  end

  def query collection, pipeline, token:
    result = call_tool('query_data_collections', { collection: collection, search_pipeline: pipeline }, token: token)

    assert_not result['isError'], result.dig('content', 0, 'text')
    JSON.parse(result.dig('content', 0, 'text'))
  end

  describe 'authentication' do
    test 'rejects a request without a valid API key' do
      assert_equal 401, mcp('tools/list').status
      assert_equal 401, mcp('tools/list', token: 'not-a-key').status
    end

    test 'rejects everything while MCP_SERVER is off' do
      token = token_for(doug)
      Rails.application.config.x.mcp_server_enabled = false

      assert_equal 401, mcp('tools/list', token: token).status
    end

    test 'lists the collections and tools' do
      response = mcp('tools/list', token: token_for(doug))
      names = JSON.parse(response.body)['result']['tools'].pluck('name')

      assert_includes names, 'query_data_collections'
      assert_includes names, 'create_case'
      assert_includes names, 'create_book'
      assert_includes names, 'rate_document'
    end
  end

  describe 'collections' do
    test 'cases are scoped to the token owner and their teams' do
      ids = query('case', [ { '$project' => { 'id' => 1 } }, { '$limit' => 1000 } ], token: token_for(doug)).pluck('id')

      assert_includes ids, cases(:one).id
      assert_includes ids, cases(:shared_through_owned_team).id
      assert_not_includes ids, cases(:matt_case).id

      assert_empty query('case', [ { '$match' => { 'id' => cases(:one).id } } ], token: token_for(matt))
    end

    test 'queries join to their case' do
      kase = cases(:one)
      kase.queries.create!(query_text: 'mcp join')
      rows = query('query', [
                     { '$lookup' => { 'from' => 'case', 'localField' => 'case', 'foreignField' => '_id', 'as' => 'c' } },
                     { '$match' => { 'c.id' => kase.id, 'query_text' => 'mcp join' } },
                     { '$project' => { 'query_text' => 1, 'case_name' => '$c.case_name' } }
                   ], token: token_for(doug))

      assert_equal [ { 'query_text' => 'mcp join', 'case_name' => kase.case_name } ], rows
    end

    test 'search endpoint credentials are not queryable' do
      result = call_tool('query_data_collections',
                         { collection:      'search_endpoint',
                           search_pipeline: [ { '$project' => { 'basic_auth_credential' => 1 } } ] },
                         token: token_for(doug))

      assert result['isError']
    end
  end

  describe 'tools' do
    test 'create_case, create_query, rate_document and delete_query' do
      token = token_for(doug)
      kase = JSON.parse(call_tool('create_case', { case_name: 'From MCP' }, token: token).dig('content', 0, 'text'))

      assert_equal doug.id, kase['owner_id']
      assert_equal 1, Case.find(kase['id']).tries.count

      query = JSON.parse(call_tool('create_query', { case_id: kase['id'], query_text: ' boots ' },
                                   token: token).dig('content', 0, 'text'))

      assert_equal 'boots', query['query_text']

      call_tool('rate_document', { query_id: query['id'], doc_id: 'doc1', rating: 3 }, token: token)

      assert_in_delta 3.0, Query.find(query['id']).ratings.find_by(doc_id: 'doc1').rating

      call_tool('delete_query', { query_id: query['id'] }, token: token)

      assert_not Query.exists?(query['id'])
    end

    test 'records the same analytics events as the REST API' do
      token = token_for(doug)

      assert_difference -> { Ahoy::Event.where(user_id: doug.id, name: 'cases:created_a_case').count } do
        call_tool('create_case', { case_name: 'Tracked from MCP' }, token: token)
      end

      kase = doug.cases.find_by(case_name: 'Tracked from MCP')

      assert_difference -> { Ahoy::Event.where(user_id: doug.id).count } do
        call_tool('create_query', { case_id: kase.id, query_text: 'tracked' }, token: token)
      end
      assert_nil Ahoy.instance
    end

    test 'cannot change a case the user cannot see' do
      result = call_tool('update_case', { case_id: cases(:one).id, case_name: 'hijack' }, token: token_for(matt))

      assert result['isError']
      assert_not_equal 'hijack', cases(:one).reload.case_name
    end

    test 'create_book copies the scorer scale' do
      scorer = scorers(:communal_scorer)
      book = JSON.parse(call_tool('create_book', { name: 'MCP book', scorer_id: scorer.id },
                                  token: token_for(doug)).dig('content', 0, 'text'))

      assert_equal doug.id, book['owner_id']
      assert_equal scorer.scale, Book.find(book['id']).scale
    end
  end
end
