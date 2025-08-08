# frozen_string_literal: true

require 'test_helper'

class CuratorVariableTest < ActiveSupport::TestCase
  describe 'integer values' do
    it 'returns a float if the value is set to a float' do
      var = curator_variables(:a_float)

      assert var.value.is_a?(Float), "Value given is not a float: #{var.value}"
    end

    it 'returns an integer if the value is set to a integer' do
      var = curator_variables(:an_int)

      assert var.value.is_a?(Integer), "Value given is not an integer: #{var.value}"
    end
  end
end
