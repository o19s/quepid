# frozen_string_literal: true

require 'test_helper'

class TriesAncestryLifecycleTest < ActionDispatch::IntegrationTest
  include ActionMailer::TestHelper

  test 'create 200 tries behavior' do
    root = Try.new(name: "Try Root")
    root.save!

    parent = root
    200.times do |i|
      try = Try.new(name: "Try #{i}")
      try.parent = parent
      try.save!
      parent = try
    end

    puts "hi"
    #puts root.subtree.tree_view(:name)
    require 'pp'
    pp root
    pp root.children[0].children

    root.subtree.each{|n| puts "#{n.name}: #{n.ancestry}"}

    puts root.descendant_ids






  #  assert_includes try_one.children, try_two
  #  assert_includes try_two.children, try_three

  #  try_two.destroy!

    # validate that three gets adopted by one
  #  assert_includes try_one.children, try_three
  end

end
