# frozen_string_literal: true

# == Schema Information
#
# Table name: teams
#
#  id         :integer          not null, primary key
#  name       :string(255)
#  created_at :datetime         not null
#  updated_at :datetime         not null
#
# Indexes
#
#  index_teams_on_name  (name)
#

require 'test_helper'

class TeamTest < ActiveSupport::TestCase
  describe 'validations' do
    test 'requires a name' do
      team = Team.new

      assert_not team.valid?
      assert_includes team.errors[:name], "can't be blank"
    end

    test 'requires a unique name' do
      existing = teams(:valid)

      team = Team.new name: existing.name

      assert_not team.valid?
      assert_includes team.errors[:name], 'has already been taken'
    end

    test 'is valid with a unique name' do
      team = Team.new name: 'A brand new team'

      assert_predicate team, :valid?
    end
  end

  describe 'associations' do
    let(:team) { teams(:shared) }

    test 'has and belongs to many members' do
      assert_includes team.members, users(:doug)
      assert_includes team.members, users(:random)
    end

    test 'has and belongs to many cases' do
      assert_includes team.cases, cases(:shared_with_team)
    end

    test 'has and belongs to many scorers' do
      assert_includes team.scorers, scorers(:shared_scorer)
    end

    test 'has and belongs to many search_endpoints' do
      assert_includes team.search_endpoints, search_endpoints(:one)
    end

    test 'has and belongs to many books' do
      assert_includes team.books, books(:james_bond_movies)
    end

    test 'adding a member does not require re-saving the team' do
      team = teams(:owned_team)
      new_member = users(:random_2)

      team.members << new_member

      assert_includes team.reload.members, new_member
    end
  end
end
