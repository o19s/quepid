# frozen_string_literal: true

module Arrangement
  module List
    STARTING_POSITION = 0
    ENDING_POSITION   = 9_223_372_036_854_775_807

    class << self
      # Bootstrap a node to have the default
      # STARTING_POSITION & ENDING_POSITION values
      def bootstrap node
        node.arranged_at    = STARTING_POSITION
        node.arranged_next  = ENDING_POSITION
      end

      # Add new node to the beginning of the list
      def prepend new_node, first_node
        new_node.arranged_at    = first_node.arranged_at
        new_node.arranged_next  = first_node.arranged_next

        arrange_after(new_node, first_node)
      end

      # Arrange new node after existing node
      def arrange_after existing_node, new_node
        start_position    = existing_node.arranged_at
        distance_to_next  = existing_node.arranged_next - existing_node.arranged_at
        new_node_position = new_position_large(start_position, distance_to_next)

        arrange_at(existing_node, new_node, new_node_position)
      end

      # Rearrange nodes to be sorted by the arragned_at attribute
      def sequence nodes, normalize = true
        return [] if nodes.blank?

        sorted_nodes = nodes.sort_by { |node| node.arranged_at || 0 }

        sorted_nodes = normalize(sorted_nodes) if normalize

        sorted_nodes
      end

      private

      def new_position_large start_position, distance_to_next
        start_position + (distance_to_next / 2)
      end

      def new_position_small start_position, distance_to_next
        number_of_digits  = distance_to_next.to_s.size
        increment         = (10**number_of_digits) / 100

        start_position + distance_to_next - increment
      end

      # Evenly space the nodes
      def normalize sorted_nodes
        range = ENDING_POSITION - STARTING_POSITION
        space = range / sorted_nodes.length

        sorted_nodes.each_with_index do |node, i|
          arranged_at   = i * space
          arranged_next = (i + 1) * space

          node.arranged_at    = arranged_at
          node.arranged_next  = arranged_next
        end

        sorted_nodes.last.arranged_next = ENDING_POSITION if sorted_nodes.present?

        sorted_nodes
      end

      # Arrange new node relative to existing node at the position provided
      def arrange_at existing_node, new_node, new_node_position
        current_next_node = existing_node.arranged_next

        existing_node.arranged_next = new_node_position

        new_node.arranged_at    = new_node_position
        new_node.arranged_next  = current_next_node
      end
    end
  end
end
