# frozen_string_literal: true

require 'test_helper'
require 'ostruct'
# require 'arrangement/list'

# rubocop:disable Style/StructInheritance
class Node < Struct.new(:id, :arranged_at, :arranged_next)
end
# rubocop:enable Style/StructInheritance

module Arrangement
  class ListTest < ActiveSupport::TestCase
    describe 'bootstrap' do
      test 'sets the arranged at attribute to the starting position' do
        node = Node.new
        List.bootstrap(node)

        assert_equal node.arranged_at, List::STARTING_POSITION
      end

      test 'sets the arranged next attribute to the ending position' do
        node = Node.new
        List.bootstrap(node)

        assert_equal node.arranged_next, List::ENDING_POSITION
      end
    end

    describe 'arrange_after' do
      test 'adds new node after existing node' do
        existing_node = Node.new rand(100)
        List.bootstrap(existing_node)

        new_node = Node.new rand(100)
        loop do
          break if new_node.id == existing_node.id

          new_node = Node.new rand(100)
        end

        List.arrange_after(existing_node, new_node)

        sequence = List.sequence [ new_node, existing_node ]

        assert_equal [ existing_node, new_node ], sequence
      end

      test 'adds multiple new nodes' do
        node1 = Node.new 1
        node2 = Node.new 2
        node3 = Node.new 3
        node4 = Node.new 4

        List.bootstrap(node1)

        List.arrange_after(node1, node2)
        List.arrange_after(node1, node3)
        List.arrange_after(node1, node4)

        sequence = List.sequence [ node1, node2, node3, node4 ]

        assert_equal [ node1, node4, node3, node2 ], sequence
      end
    end

    describe 'prepend' do
      test 'adds new node to the beginning of the list' do
        node1 = Node.new 1
        node2 = Node.new 2

        List.bootstrap(node1)
        List.prepend(node2, node1)

        sequence = List.sequence [ node1, node2 ]

        assert_equal [ node2, node1 ], sequence
      end

      test 'adds multiple new nodes to the beginning of the list' do
        node1 = Node.new 1
        node2 = Node.new 2
        node3 = Node.new 3
        node4 = Node.new 4

        List.bootstrap(node1)

        List.prepend(node2, node1)
        List.prepend(node3, node2)
        List.prepend(node4, node3)

        sequence = List.sequence [ node1, node2, node3, node4 ]

        assert_equal [ node4, node3, node2, node1 ], sequence
      end
    end

    describe 'sequence' do
      test 'handles empty list' do
        sequence = List.sequence []

        assert_empty sequence
      end
    end

    describe 'remove items' do
      test 'removes items by appending another item in their place' do
        node1 = Node.new 1
        node2 = Node.new 2
        node3 = Node.new 3
        node4 = Node.new 4

        List.bootstrap(node1)

        List.arrange_after(node1, node2)
        List.arrange_after(node1, node3)
        List.arrange_after(node1, node4)

        sequence = List.sequence [ node1, node2, node3, node4 ]

        assert_equal [ node1, node4, node3, node2 ], sequence

        # Splice out node4
        List.arrange_after(node1, node3)

        sequence = List.sequence [ node1, node2, node3 ]

        assert_equal [ node1, node3, node2 ], sequence
      end

      test 'removes items then appends new items' do
        nodes = (0..10).map { |i| Node.new i }

        List.bootstrap(nodes.first)

        previous_node = nodes.first
        nodes[1..].each do |node|
          List.arrange_after(previous_node, node)
          previous_node = node
        end

        sequence = List.sequence nodes
        assert_equal nodes, sequence

        # Orphan out everything in the middle
        List.arrange_after(nodes.first, nodes.last)

        sequence = List.sequence [ nodes.first, nodes.last ]
        assert_equal [ nodes.first, nodes.last ], sequence

        # Reappend new nodes
        new_nodes = (11..30).map { |i| Node.new i }

        previous_node = nodes.first
        new_nodes.each do |node|
          List.arrange_after(previous_node, node)
          previous_node = node
        end

        sequence = List.sequence [ nodes.first ] + new_nodes
        assert_equal [ nodes.first ] + new_nodes, sequence

        # Append to the end
        end_nodes = (31..50).map { |i| Node.new i }

        previous_node = new_nodes.last
        end_nodes.each do |node|
          List.arrange_after(previous_node, node)
          previous_node = node
        end

        sequence = List.sequence [ nodes.first ] + new_nodes + end_nodes
        assert_equal [ nodes.first ] + new_nodes + end_nodes, sequence
      end
    end
  end
end
