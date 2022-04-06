# frozen_string_literal: true

require 'test_helper'

class TriesAncestryLifecycleTest < ActionDispatch::IntegrationTest
  test 'create 200 tries behavior' do
    root = Try.new(name: 'Try Root')
    root.save!

    parent = root
    200.times do |i|
      try = Try.new(name: "Try #{i}")
      try.parent = parent
      try.save!
      parent = try
    end
  end

  test 'Creates a new root try when ancestry tree gets to be too much' do
    root_tries = []
    root = Try.new(name: 'Try Root')
    root.save!
    root_tries << root

    valueTooLongConditionHit = false
    parent = root
    300.times do |i|
      try = Try.new(name: "Try #{i}")
      try.parent = parent
      begin
        try.save!
      rescue ActiveRecord::ValueTooLong
        valueTooLongConditionHit = true
        try.parent = nil
        try.save!
        root_tries << try
      end
      parent = try
    end

    assert valueTooLongConditionHit
    assert_equal 2, root_tries.length
  end
end
