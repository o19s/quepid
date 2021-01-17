# frozen_string_literal: true

require 'test_helper'

class UserTeamFinderTest < ActiveSupport::TestCase
  let(:user)          { users(:team_finder_user) }
  let(:owned_team)    { teams(:owned_team) }
  let(:shared_team)   { teams(:shared_team) }

  let(:service)       { UserTeamFinder.new(user) }

  describe 'Find all teams' do
    test 'returns an array of teams' do
      result = service.all

      # no longer able to run assert_instance_of Team::ActiveRecord_Relation, result
      assert_equal 'Team::ActiveRecord_Relation', result.class.to_s
    end

    test 'includes teams owned by user' do
      result = service.all

      assert_includes result, owned_team
    end

    test "includes teams from user's shared team" do
      result = service.all

      assert_includes result, shared_team
    end
  end

  describe 'Find all teams that match params' do
    test 'returns an empty array if no results match' do
      result = service.where(id: 123).all

      assert_equal        'Team::ActiveRecord_Relation', result.class.to_s
      assert_equal        0, result.length
    end

    test 'works when filtering by id' do
      result = service.where(id: owned_team.id).all

      assert_equal        'Team::ActiveRecord_Relation', result.class.to_s
      assert_equal        1,      result.length
      assert_includes     result, owned_team
    end

    test 'works with complex where clause for owned teams' do
      result = service.where('`teams`.`name` LIKE ?', '%owned by%').all

      assert_equal        'Team::ActiveRecord_Relation', result.class.to_s
      assert_equal        1,      result.length
      assert_includes     result, owned_team
    end

    test 'works with complex where clause for teams the user is a member of' do
      result = service.where('`teams`.`name` LIKE ?', '%shared with%').all

      assert_equal        'Team::ActiveRecord_Relation', result.class.to_s
      assert_equal        1,      result.length
      assert_includes     result, shared_team
    end

    test 'works when querying on the name for owned teams' do
      result = service.where(name: 'Team owned by Team Finder User').all

      assert_equal        'Team::ActiveRecord_Relation', result.class.to_s
      assert_equal        1,      result.length
      assert_includes     result, owned_team
    end

    test 'works when querying on the name for teams the user is a member of' do
      result = service.where(name: 'Team shared with Team Finder User').all

      assert_equal        'Team::ActiveRecord_Relation', result.class.to_s
      assert_equal        1,      result.length
      assert_includes     result, shared_team
    end
  end

  describe 'Find first team that matches params' do
    test 'returns nil if no results match' do
      result = service.where(id: 123).first

      assert_nil result
    end

    test 'works when filtering by id' do
      result = service.where(id: owned_team.id)
        .order(name: :asc)
        .first

      assert_instance_of  Team,  result
      assert_equal        result, owned_team
    end

    test 'works with complex where clause for owned teams' do
      result = service.where('`teams`.`name` LIKE ?', '%owned by%').first

      assert_instance_of  Team, result
      assert_equal        result, owned_team
    end

    test 'works with complex where clause for teams the user is a member of' do
      result = service.where('`teams`.`name` LIKE ?', '%shared with%').first

      assert_instance_of  Team, result
      assert_equal        result, shared_team
    end

    test 'works when querying on the name for owned teams' do
      result = service.where(name: 'Team owned by Team Finder User').first

      assert_instance_of  Team, result
      assert_equal        result, owned_team
    end

    test 'works when querying on the name for teams the user is a member of' do
      result = service.where(name: 'Team shared with Team Finder User').first

      assert_instance_of  Team, result
      assert_equal        result, shared_team
    end
  end

  describe 'Find last team that matches params' do
    test 'returns nil if no results match' do
      result = service.where(id: 123).last

      assert_nil result
    end

    test 'works when filtering by id' do
      result = service.where(id: owned_team.id)
        .order(name: :desc)
        .last

      assert_instance_of  Team,  result
      assert_equal        result, owned_team
    end

    test 'works with complex where clause for owned teams' do
      result = service.where('`teams`.`name` LIKE ?', '%owned by%').last

      assert_instance_of  Team, result
      assert_equal        result, owned_team
    end

    test 'works with complex where clause for teams the user is a member of' do
      result = service.where('`teams`.`name` LIKE ?', '%shared with%').last

      assert_instance_of  Team, result
      assert_equal        result, shared_team
    end

    test 'works when querying on the name for owned teams' do
      result = service.where(name: 'Team owned by Team Finder User').last

      assert_instance_of  Team, result
      assert_equal        result, owned_team
    end

    test 'works when querying on the name for teams the user is a member of' do
      result = service.where(name: 'Team shared with Team Finder User').last

      assert_instance_of  Team, result
      assert_equal        result, shared_team
    end
  end
end
