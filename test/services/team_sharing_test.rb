# frozen_string_literal: true

require 'test_helper'

class TeamSharingTest < ActiveSupport::TestCase
  setup do
    @previous_ahoy = Thread.current[:ahoy]
    events = @analytics_events = []
    Thread.current[:ahoy] = Object.new
    Thread.current[:ahoy].define_singleton_method(:track) do |name, properties|
      events << [ name, properties ]
    end
  end

  teardown do
    Thread.current[:ahoy] = @previous_ahoy
  end

  test 'form assignment replaces visible teams and preserves hidden teams' do
    user = users(:random)
    book = books(:book_of_comedy_films)
    hidden = Team.create!(name: 'Hidden team')
    book.teams = [ user.teams.first, hidden ]
    service = TeamSharing.new(user)
    service.assign_teams(book, [ '', user.teams.last.id.to_s, user.teams.last.id.to_s ])
    assert_equal [ hidden.id, user.teams.last.id ].sort, book.reload.team_ids.sort
    service.assign_teams(book, [])
    assert_equal [ hidden.id ], book.reload.team_ids
  end

  test 'case sharing includes its endpoint and is idempotent' do
    user = users(:joey)
    team = teams(:case_finder_shared_team)
    kase = cases(:case_with_two_tries)
    service = TeamSharing.new(user, team)
    assert service.share(kase)
    assert_not service.share(kase)
    assert team.cases.exists?(kase.id)
    assert team.search_endpoints.exists?(kase.tries.latest.search_endpoint.id)
    assert service.unshare(kase)
    assert_not service.unshare(kase)
    assert team.search_endpoints.exists?(kase.tries.latest.search_endpoint.id)
  end

  test 'inaccessible teams and records cannot be shared' do
    assert_raises(ActiveRecord::RecordNotFound) { TeamSharing.new(users(:joey), teams(:valid)) }
    service = TeamSharing.new(users(:joey), teams(:case_finder_shared_team))
    error = assert_raises(TeamSharing::AccessDenied) { service.share(cases(:random_case)) }
    assert_equal 'Case', error.model
    assert_raises(TeamSharing::AccessDenied) { service.unshare(cases(:random_case)) }
  end

  test 'book sharing emits its historical event only when membership changes' do
    service = TeamSharing.new(users(:random), teams(:case_finder_owned_team))
    book = books(:book_of_star_wars_judgements)

    assert service.share(book)
    assert_not service.share(book)
    assert_equal [
      [ 'books:shared_a_book', { category: 'Books', action: 'Shared a Book', label: book.name, value: nil } ]
    ], @analytics_events
  end

  test 'endpoint sharing emits its historical event only when membership changes' do
    service = TeamSharing.new(users(:random), teams(:case_finder_owned_team))
    endpoint = search_endpoints(:one)

    assert service.share(endpoint)
    assert_not service.share(endpoint)
    assert_equal [
      [ 'search_endpoints:shared_a_search_endpoint', { category: 'Search Endpoints', action: 'Shared a Search Endpoint', label: endpoint.fullname, value: nil } ]
    ], @analytics_events
  end
end
