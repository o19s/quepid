# frozen_string_literal: true

require 'test_helper'

# Part 18 of the manual testing guide (docs/manual-testing/18-api-workflows.md) drives the API as
# a cookie-free client with a Bearer token. These cover the Part 18 checks the controller tests
# didn't, so a manual pass no longer has to repeat them.
class ApiWorkflowsTest < ActionDispatch::IntegrationTest
  def api method, path, as: users(:random), params: nil
    key = ApiKey.create!(user: as, token: SecureRandom.hex)
    send method, path, params: params&.to_json, headers: {
      'Authorization' => ActionController::HttpAuthentication::Token.encode_credentials(key.token_digest),
      'Accept'        => 'application/json',
      'Content-Type'  => 'application/json',
    }
  end

  # 18.1
  test 'case lists accept form-style archived values' do
    user = users(:random)
    archived = user.cases.create!(case_name: 'Archived API case', archived: true)

    { '1' => true, 'true' => true, '0' => false, 'false' => false }.each do |value, only_archived|
      api :get, api_cases_path(archived: value), as: user
      assert_response :ok
      ids = response.parsed_body['all_cases'].pluck('case_id')
      assert_equal only_archived, ids.include?(archived.id), "archived=#{value}"
    end
  end

  # 18.1
  test 'a list of more than 30 involved cases leaves out teams and last scores' do
    user = users(:random)
    api :get, api_cases_path, as: user
    assert_response :ok
    assert(response.parsed_body['all_cases'].all? { |c| c.key?('teams') })

    (31 - user.cases_involved_with.size).times { |i| user.cases.create!(case_name: "Bulk case #{i}") }
    api :get, api_cases_path, as: user
    assert_response :ok
    cases = response.parsed_body['all_cases']
    assert_operator cases.size, :>, 30
    assert(cases.none? { |c| c.key?('teams') || c.key?('last_score') })
  end

  # 18.3
  test 'a zero rating and a leading-zero document id are stored exactly' do
    query = queries(:first_query)
    path = api_case_query_ratings_path(query.case, query)

    api :put, path, params: { rating: { doc_id: '007:a/b.c', rating: 0 } }
    assert_response :ok
    api :put, path, params: { rating: { doc_id: '007:a/b.c', rating: 0 } }
    assert_response :ok

    ratings = query.ratings.where(doc_id: '007:a/b.c')
    assert_equal 1, ratings.count
    assert_equal 0, ratings.first.rating
  end

  # 18.3
  test 'bulk ratings clear through DELETE and the legacy POST delete alias' do
    query = queries(:first_query)
    ids = %w[bulk-a bulk-b]
    api :put, api_case_query_bulk_ratings_path(query.case, query), params: { doc_ids: ids, rating: 2 }
    assert_response :no_content
    assert_equal [ 2, 2 ], query.ratings.where(doc_id: ids).pluck(:rating)

    api :post, ratings_delete_api_case_query_bulk_path(query.case, query), params: { doc_ids: [ 'bulk-a' ] }
    assert_response :no_content
    api :delete, api_case_query_bulk_ratings_path(query.case, query), params: { doc_ids: [ 'bulk-b' ] }
    assert_response :no_content
    assert_empty query.ratings.where(doc_id: ids)
  end

  # 18.5
  test 'adding a member by mixed-case email and then by id makes one membership' do
    owner = users(:random)
    api :post, api_teams_path, as: owner, params: { team: { name: "API workflow team #{SecureRandom.hex(4)}" } }
    assert_response :ok
    team = Team.find(response.parsed_body['id'])
    member = users(:doug)

    api :post, api_team_members_path(team), as: owner, params: { id: member.email.swapcase }
    api :post, api_team_members_path(team), as: owner, params: { id: member.id }

    assert_equal 1, team.members.where(id: member.id).count
  end

  # 18.8
  test 'user lookup agrees across id and mixed-case email and exposes no secrets' do
    member = users(:doug)
    # An unescaped dot in a path segment is read as a format suffix, so clients escape it.
    bodies = [ member.id.to_s, member.email.swapcase.gsub('.', '%2E') ].map do |id|
      api :get, "/api/users/#{id}"
      assert_response :ok
      response.parsed_body
    end

    assert_equal bodies.first, bodies.last
    assert_equal member.id, bodies.first['id']
    assert_empty bodies.first.keys.grep(/password|token|digest|invitation/i)
  end
end
