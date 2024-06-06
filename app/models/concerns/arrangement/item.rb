# frozen_string_literal: true

require_relative 'list'

module Arrangement
  module Item
    extend ActiveSupport::Concern

    included do
      before_create :prepend_node_to_list
    end

    def insert_at position
      ensure_sequencing
      list = parent_list

      if list.blank?
        List.bootstrap(self)
      elsif position.zero?
        first_node = list.first
        List.prepend(self, first_node)
      elsif list.length > position
        previous_node = list[position - 1]
        List.arrange_after(previous_node, self)
      else
        previous_node = list.last
        List.arrange_after(previous_node, self)
      end
    end

    def move_to previous_node_id, reverse = false
      ensure_sequencing
      list = parent_list

      if list.blank?
        List.bootstrap(self)
      elsif reverse
        previous_node = list.find_by(id: previous_node_id)
        List.prepend(self, previous_node)
      else
        previous_node = list.find_by(id: previous_node_id)
        List.arrange_after(previous_node, self)
      end

      previous_node&.save
      save
    end

    def remove_from_list
      self.arranged_at    = nil
      self.arranged_next  = nil
    end

    private

    def prepend_node_to_list
      list = parent_list

      if list.blank?
        List.bootstrap(self)
      else
        List.sequence list
        first_node = list.first
        List.prepend(self, first_node)
      end
    end

    def ensure_sequencing
      return if parent_list.blank?

      List.sequence(parent_list)
      list_owner.save
    end
  end
end
