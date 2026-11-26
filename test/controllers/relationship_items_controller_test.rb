# frozen_string_literal: true

require 'test_helper'

class RelationshipItemsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:doug)
    login_user_for_integration_test @user
    @book = Book.create!(name: 'Relationship book', owner: @user)
    @scorer = Scorer.create!(name: 'Relationship scorer', owner: @user, scale: [ 0, 1 ])
    @embedder = embedders(:openai_small)
    @endpoint = SearchEndpoint.create!(name: 'Relationship endpoint', owner: @user, search_engine: 'solr',
                                       endpoint_url: 'http://example.com/select', api_method: 'GET')
    @case = Case.create!(case_name: 'Relationship case', owner: @user, book: @book, scorer: @scorer, embedder: @embedder)
    @case.tries.first.update!(search_endpoint: @endpoint)
  end

  test 'team pills list accessible teams for every supported resource type' do
    hidden = Team.create!(name: 'Hidden relationship team')
    judge = AiJudge.create!(name: 'Relationship judge', owner: @user, system_prompt: 'Judge it.')
    [ @book, @scorer, @embedder, @endpoint, @case, judge ].each do |record|
      record.teams |= [ teams(:valid), hidden ]

      get relationship_items_url(record_type: record.class.model_name.singular, id: record.id, kind: 'teams')

      assert_response :success
      assert_select 'a[href=?]', team_path(teams(:valid)), text: teams(:valid).name
      assert_no_match(/Hidden relationship team/, response.body)
    end
  end

  test 'case pills show visible cases for books scorers embedders and endpoints' do
    hidden = Case.create!(case_name: 'Hidden relationship case', owner: users(:joey), book: @book, scorer: @scorer, embedder: @embedder)
    hidden.tries.first.update!(search_endpoint: @endpoint)
    @case.tries.create!(try_number: 2, search_endpoint: @endpoint)

    [ @book, @scorer, @embedder, @endpoint ].each do |record|
      get relationship_items_url(record_type: record.class.model_name.singular, id: record.id, kind: 'cases')

      assert_response :success
      assert_select 'a[href=?]', case_core_path(id: @case.id), text: @case.case_name, count: 1
      assert_no_match(/Hidden relationship case/, response.body)
    end
  end

  test 'try pills link to the specific try and omit inaccessible cases' do
    @case.tries.first.update!(name: 'Baseline')
    hidden = Case.create!(case_name: 'Hidden try case', owner: users(:joey))
    hidden.tries.first.update!(search_endpoint: @endpoint)

    get relationship_items_url(record_type: 'search_endpoint', id: @endpoint.id, kind: 'tries')

    assert_response :success
    assert_select 'a[href=?]', case_core_path(id: @case.id, try_number: 1), text: /Relationship case.*Try 1.*Baseline/
    assert_no_match(/Hidden try case/, response.body)
  end

  test 'rejects inaccessible sources unsupported types and unsupported relationships' do
    get relationship_items_url(record_type: 'embedder', id: embedders(:private_ollama).id, kind: 'cases')
    assert_response :not_found

    get relationship_items_url(record_type: 'user', id: @user.id, kind: 'teams')
    assert_response :not_found

    get relationship_items_url(record_type: 'book', id: @book.id, kind: 'tries')
    assert_response :bad_request
  end

  test 'a stale count returns a compact empty state' do
    get relationship_items_url(record_type: 'scorer', id: @scorer.id, kind: 'teams')

    assert_response :success
    assert_select '[data-connection-usage-list]', text: 'No items to show.'
  end
end
