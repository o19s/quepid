# frozen_string_literal: true

# == Schema Information
#
# Table name: permissions
#
#  id         :integer          not null, primary key
#  action     :string(255)      not null
#  model_type :string(255)      not null
#  on         :boolean          default(FALSE)
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  user_id    :integer
#

require 'test_helper'

class PermissionTest < ActiveSupport::TestCase
  describe 'defaults' do
    let(:user) { users(:random) }

    test 'sets the on attribute to false by default' do
      permission = user.permissions.create(model_type: 'user', action: 'update')

      assert false == permission.on
    end
  end

  describe 'default user permissions' do
    test 'initializes the default set of permissions when a user is created' do
      assert_difference 'Permission.count', Permissible::PERMISSIONS.count do
        User.create email: 'permission@example.com', password: 'password', agreed: true
      end
    end
  end

  describe 'check user permissions' do
    let(:user) { users(:random) }

    test 'returns false if user does not have the permission' do
      assert_not user.has_permission? 'foo', 'bar'
    end

    test 'returns true if user does have the permission' do
      user.permissions.create(model_type: 'user', action: 'update')

      assert user.has_permission? 'user', 'update'
    end

    test 'returns false if user is not assigned the permission' do
      user.permissions.create(model_type: 'user', action: 'update')

      assert_not user.permitted_to? 'user', 'update'
    end

    test 'returns true if user is assigned the permission' do
      user.permissions.create(model_type: 'user', action: 'update', on: true)

      assert user.permitted_to? 'user', 'update'
    end
  end
end
