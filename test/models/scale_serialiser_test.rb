# frozen_string_literal: true

require 'test_helper'

class ScaleSerializerTest < ActiveSupport::TestCase
  test 'load data with scale serializer' do
    load = ScaleSerializer.load('1,2,3,4')
    assert_equal [ 1, 2, 3, 4 ], load
  end

  test 'dump data with serializer' do
    dump = ScaleSerializer.dump([ 1, 2, 3, 4 ])
    assert_equal '1,2,3,4', dump
  end
end
