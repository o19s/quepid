# frozen_string_literal: true

require 'test_helper'

class TeamSharingTest < ActiveSupport::TestCase
  setup do
    @previous_ahoy = Thread.current[:ahoy]
    Thread.current[:ahoy] = Class.new { def track(*) = nil }.new
  end

  teardown do
    Thread.current[:ahoy] = @previous_ahoy
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
    assert_raises(ActiveRecord::RecordNotFound) { service.share(cases(:random_case)) }
  end
end
