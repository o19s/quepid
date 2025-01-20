# frozen_string_literal: true

require 'test_helper'

class ForUserScopeTest < ActiveSupport::TestCase
  describe 'Case.for_user' do
    it 'includes directly owned cases' do
      cases = Case.for_user(users(:doug))
      assert cases.include?(cases(:one))
    end

    it 'includes cases connected to teams' do
      cases = Case.for_user(users(:doug))
      assert cases.include?(cases(:shared_with_team))
    end

    it 'excludes other cases' do
      cases = Case.for_user(users(:doug))
      assert cases.exclude?(cases(:matt_case))
    end

    it 'returns distinct cases' do
      case_ids = Case.for_user(users(:random)).pluck(:id)
      assert_equal case_ids, case_ids.uniq
    end
  end
end
