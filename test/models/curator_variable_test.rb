# frozen_string_literal: true

# == Schema Information
#
# Table name: curator_variables
#
#  id         :integer          not null, primary key
#  name       :string(500)
#  value      :float(24)
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  try_id     :integer
#
# Indexes
#
#  try_id  (try_id)
#

require 'test_helper'

class CuratorVariableTest < ActiveSupport::TestCase
  describe 'integer values' do
    it 'returns a float if the value is set to a float' do
      var = curator_variables(:a_float)

      assert_kind_of Float, var.value, "Value given is not a float: #{var.value}"
    end

    it 'returns an integer if the value is set to a integer' do
      var = curator_variables(:an_int)

      assert_kind_of Integer, var.value, "Value given is not an integer: #{var.value}"
    end
  end
end
