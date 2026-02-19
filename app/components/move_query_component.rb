# frozen_string_literal: true

# Renders the "Move Query" trigger and modal to move a query to another case.
# Works with the move_query Stimulus controller. Replaces the Angular move_query component.
#
# @see docs/view_component_conventions.md
class MoveQueryComponent < ApplicationComponent
  # @param query_id [Integer] Query to move
  # @param case_id [Integer] Current case (query is in this case; excluded from target list)
  # @param other_cases [Array<Hash>, ActiveRecord::Relation] Cases the user can move to (id, name)
  # @param try_number [Integer, nil] Current try (for redirect after move; optional)
  def initialize query_id:, case_id:, other_cases:, try_number: nil
    @query_id    = query_id
    @case_id     = case_id
    @try_number  = try_number
    @other_cases = other_cases.respond_to?(:to_ary) ? other_cases.to_ary : other_cases.to_a
  end

  def other_cases_for_list
    @other_cases.map { |c| c.respond_to?(:id) ? { id: c.id, name: c.case_name } : { id: c[:id] || c['id'], name: c[:case_name] || c['case_name'] || c[:name] || c['name'] } }
  end
end
