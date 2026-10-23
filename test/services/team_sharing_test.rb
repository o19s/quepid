# frozen_string_literal: true

require 'test_helper'

class TeamSharingTest < ActiveSupport::TestCase
  cover 'TeamSharing*'

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

  test 'case sharing emits its historical event only when membership changes' do
    service = TeamSharing.new(users(:joey), teams(:case_finder_shared_team))
    kase = cases(:case_with_two_tries)

    assert service.share(kase)
    assert_not service.share(kase)
    assert_equal [
      [ 'cases:shared_a_case', { category: 'Cases', action: 'Shared a Case', label: kase.case_name, value: nil } ]
    ], @analytics_events
  end

  test 'scorer sharing emits its historical event only when membership changes' do
    user = users(:random)
    scorer = Scorer.create!(name: 'Shareable scorer', code: 'pass();', scale: [ 1, 2, 3 ], owner: user)
    service = TeamSharing.new(user, teams(:case_finder_owned_team))

    assert service.share(scorer)
    assert_not service.share(scorer)
    assert_equal [
      [ 'scorers:shared_a_scorer', { category: 'Scorers', action: 'Shared a Scorer', label: 'Shareable scorer', value: nil } ]
    ], @analytics_events
  end

  test 'sharing a case does not duplicate an endpoint the team already has' do
    team = teams(:case_finder_shared_team)
    kase = cases(:case_with_two_tries)
    endpoint = kase.tries.latest.search_endpoint
    team.search_endpoints << endpoint

    assert_no_difference -> { team.search_endpoints.count } do
      TeamSharing.new(users(:joey), team).share(kase)
    end
  end

  test 'sharing a case without any try shares only the case' do
    user = users(:joey)
    team = teams(:case_finder_shared_team)
    kase = Case.create!(case_name: 'No tries', owner: user)
    kase.tries.destroy_all

    assert_no_difference -> { team.search_endpoints.count } do
      assert TeamSharing.new(user, team).share(kase)
    end
    assert team.cases.exists?(kase.id)
  end

  test 'sharing a non-case record never touches the team search endpoints' do
    team = teams(:case_finder_owned_team)

    assert_no_difference -> { team.search_endpoints.count } do
      TeamSharing.new(users(:random), team).share(books(:book_of_star_wars_judgements))
    end
  end

  test 'share and unshare return exactly true or false' do
    service = TeamSharing.new(users(:random), teams(:case_finder_owned_team))
    book = books(:book_of_star_wars_judgements)

    assert_same true, service.share(book)
    assert_same false, service.share(book)
    assert_same true, service.unshare(book)
    assert_same false, service.unshare(book)
  end

  test 'form assignment with no submitted ids removes only the visible teams' do
    user = users(:random)
    book = books(:book_of_comedy_films)
    hidden = Team.create!(name: 'Hidden team')
    book.teams = [ user.teams.first, hidden ]

    TeamSharing.new(user).assign_teams(book, nil)

    assert_equal [ hidden.id ], book.reload.team_ids
  end

  test 'form assignment rejects a team the user does not belong to without changing membership' do
    user = users(:random)
    book = books(:book_of_comedy_films)
    book.teams = [ user.teams.first ]
    outsider = Team.create!(name: 'Outsider team')

    assert_raises(ActiveRecord::RecordNotFound) do
      TeamSharing.new(user).assign_teams(book, [ user.teams.last.id, outsider.id ])
    end
    assert_equal [ user.teams.first.id ], book.reload.team_ids
  end
end
