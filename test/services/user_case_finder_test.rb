# frozen_string_literal: true

require 'test_helper'

class UserCaseFinderTest < ActiveSupport::TestCase
  let(:user)              { users(:case_finder_user) }
  let(:owned_case)        { cases(:owned_case) }
  let(:owned_team_case)   { cases(:owned_team_case) }
  let(:shared_team_case)  { cases(:shared_team_case) }

  let(:service) { UserCaseFinder.new(user) }

  describe 'Find all cases' do
    test 'returns an array of cases' do
      result = service.all

      assert_equal 'Case::ActiveRecord_Relation', result.class.to_s
    end

    test 'includes cases owned by user' do
      result = service.all

      assert_includes result, owned_case
    end

    test "includes cases from user's owned team" do
      result = service.all

      assert_includes result, owned_team_case
    end

    test "includes cases from user's shared team" do
      result = service.all

      assert_includes result, shared_team_case
    end
  end

  describe 'Find all cases that match params' do
    test 'returns an empty array if no results match' do
      result = service.where(id: 123).all

      assert_equal        'Case::ActiveRecord_Relation', result.class.to_s
      assert_equal        0, result.length
    end

    test 'works when filtering by id' do
      result = service.where(id: owned_case.id).all

      assert_equal        'Case::ActiveRecord_Relation', result.class.to_s
      assert_equal        1,      result.length
      assert_includes     result, owned_case
    end

    test 'works with complex where clause for owned cases' do
      result = service.where('`cases`.`case_name` LIKE ?', '%owned by%').all

      assert_equal        'Case::ActiveRecord_Relation', result.class.to_s
      assert_equal        1,      result.length
      assert_includes     result, owned_case
    end

    test "works with complex where clause for cases from user's owned team" do
      result = service.where('`cases`.`case_name` LIKE ?', '%owned team%').all

      assert_equal        'Case::ActiveRecord_Relation', result.class.to_s
      assert_equal        1,      result.length
      assert_includes     result, owned_team_case
    end

    test "works with complex where clause for cases from user's shared team" do
      result = service.where('`cases`.`case_name` LIKE ?', '%shared team%').all

      assert_equal        'Case::ActiveRecord_Relation', result.class.to_s
      assert_equal        1,      result.length
      assert_includes     result, shared_team_case
    end

    test 'works when querying on the name for owned cases' do
      result = service.where(case_name: 'Case owned by Case Finder User').all

      assert_equal        'Case::ActiveRecord_Relation', result.class.to_s
      assert_equal        1,      result.length
      assert_includes     result, owned_case
    end

    test "works when querying on the name for cases from user's owned team" do
      result = service.where(case_name: "Case from Case Finder User's owned team").all

      assert_equal        'Case::ActiveRecord_Relation', result.class.to_s
      assert_equal        1,      result.length
      assert_includes     result, owned_team_case
    end

    test "works when querying on the name for cases from user's shared team" do
      result = service.where(case_name: "Case from Case Finder User's shared team").all

      assert_equal        'Case::ActiveRecord_Relation', result.class.to_s
      assert_equal        1,      result.length
      assert_includes     result, shared_team_case
    end
  end

  describe 'Find first case that matches params' do
    test 'returns nil if no results match' do
      result = service.where(id: 123).first

      assert_nil result
    end

    test 'works when filtering by id' do
      result = service.where(id: owned_case.id)
        .order(case_name: :asc)
        .first

      assert_instance_of  Case,  result
      assert_equal        result, owned_case
    end

    test 'works with complex where clause for owned cases' do
      result = service.where('`cases`.`case_name` LIKE ?', '%owned by%').first

      assert_instance_of  Case, result
      assert_equal        result, owned_case
    end

    test "works with complex where clause for cases from user's owned team" do
      result = service.where('`cases`.`case_name` LIKE ?', '%owned team%').first

      assert_instance_of  Case, result
      assert_equal        result, owned_team_case
    end

    test "works with complex where clause for cases from user's shared team" do
      result = service.where('`cases`.`case_name` LIKE ?', '%shared team%').first

      assert_instance_of  Case, result
      assert_equal        result, shared_team_case
    end

    test 'works when querying on the name for owned cases' do
      result = service.where(case_name: 'Case owned by Case Finder User').first

      assert_instance_of  Case, result
      assert_equal        result, owned_case
    end

    test "works when querying on the name for cases from user's owned team" do
      result = service.where(case_name: "Case from Case Finder User's owned team").first

      assert_instance_of  Case, result
      assert_equal        result, owned_team_case
    end

    test "works when querying on the name for cases from user's shared team" do
      result = service.where(case_name: "Case from Case Finder User's shared team").first

      assert_instance_of  Case, result
      assert_equal        result, shared_team_case
    end
  end

  describe 'Find last case that matches params' do
    test 'returns nil if no results match' do
      result = service.where(id: 123).last

      assert_nil result
    end

    test 'works when filtering by id' do
      result = service.where(id: owned_case.id)
        .order(case_name: :desc)
        .last

      assert_instance_of  Case,  result
      assert_equal        result, owned_case
    end

    test 'works with complex where clause for owned cases' do
      result = service.where('`cases`.`case_name` LIKE ?', '%owned by%').last

      assert_instance_of  Case, result
      assert_equal        result, owned_case
    end

    test "works with complex where clause for cases from user's owned team" do
      result = service.where('`cases`.`case_name` LIKE ?', '%owned team%').last

      assert_instance_of  Case, result
      assert_equal        result, owned_team_case
    end

    test "works with complex where clause for cases from user's shared team" do
      result = service.where('`cases`.`case_name` LIKE ?', '%shared team%').last

      assert_instance_of  Case, result
      assert_equal        result, shared_team_case
    end

    test 'works when querying on the name for owned cases' do
      result = service.where(case_name: 'Case owned by Case Finder User').last

      assert_instance_of  Case, result
      assert_equal        result, owned_case
    end

    test "works when querying on the name for cases from user's owned team" do
      result = service.where(case_name: "Case from Case Finder User's owned team").last

      assert_instance_of  Case, result
      assert_equal        result, owned_team_case
    end

    test "works when querying on the name for cases from user's shared team" do
      result = service.where(case_name: "Case from Case Finder User's shared team").last

      assert_instance_of  Case, result
      assert_equal        result, shared_team_case
    end
  end
end
