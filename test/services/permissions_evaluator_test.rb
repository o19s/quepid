# frozen_string_literal: true

require 'test_helper'

class PermissionsEvaluatorTest < ActiveSupport::TestCase
  let(:service)   { PermissionsEvaluator.new(user) }
  let(:subject)   { service.run }
  let(:defaults)  { Permissible.grouped_permissions }

  describe 'evaluates user permissions' do
    describe 'when the user has no set permissions' do
      let(:user) { users(:random) }

      describe 'when the policy exists' do
        test 'returns the policy value' do
          policy = Pundit.policy(user, Case)

          assert_equal subject[:case][:create], policy.create?
        end
      end
    end

    describe 'when the user has defined permissions' do
      let(:user) { User.create(email: 'foo@example.com', password: 'bar') }

      before do
        user.cases << Case.create(case_name: 'Archived Case')
        user.cases.first.mark_archived!
      end

      describe 'when the policy exists' do
        test 'returns the policy value and does not override it' do
          policy = Pundit.policy(user, Case)

          assert_equal subject[:case][:create], policy.create?
        end
      end

      describe 'when the policy does not exist' do
        test 'returns the default permission value' do
          permissions = user.permissions_hash

          assert_equal subject[:case][:create_multi], permissions[:case][:create_multi]
        end
      end
    end
  end
end
