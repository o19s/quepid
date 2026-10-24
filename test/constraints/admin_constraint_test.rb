# frozen_string_literal: true

require 'test_helper'

class AdminConstraintTest < ActiveSupport::TestCase
  Request = Struct.new(:session)

  test 'does not match when there is no current user' do
    request = Request.new(session: {})

    assert_not AdminConstraint.matches?(request)
  end

  test 'matches an administrator' do
    request = Request.new(session: { 'current_user_id' => users(:admin).id })

    assert AdminConstraint.matches?(request)
  end

  test 'does not match a non-administrator' do
    request = Request.new(session: { 'current_user_id' => users(:random).id })

    assert_not AdminConstraint.matches?(request)
  end

  test 'does not match a stale user id' do
    request = Request.new(session: { 'current_user_id' => -1 })

    assert_not AdminConstraint.matches?(request)
  end
end
