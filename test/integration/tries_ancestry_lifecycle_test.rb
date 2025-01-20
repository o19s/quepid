# frozen_string_literal: true

require 'test_helper'

class TriesAncestryLifecycleTest < ActionDispatch::IntegrationTest
  test 'Creates a new root try when ancestry tree gets to be too much' do
    root_tries = []
    root = Try.new(name: 'Try Root')
    root.save!
    root_tries << root

    value_too_long_condition_hit = false
    parent = root
    300.times do |i|
      try = Try.new(name: "Try #{i}")
      try.parent = parent
      begin
        try.save!
      rescue ActiveRecord::ValueTooLong
        value_too_long_condition_hit = true
        try.parent = nil
        try.save!
        root_tries << try
      end
      parent = try
    end

    assert value_too_long_condition_hit
    assert_equal 2, root_tries.length
  end
end
