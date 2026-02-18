# frozen_string_literal: true

# Renders the "Add query" form for the case/try workspace. Replaces the Angular
# add_query directive. Submit is handled by the add_query Stimulus controller,
# which POSTs to the existing queries API (single or bulk).
#
# @see docs/view_component_conventions.md
class AddQueryComponent < ApplicationComponent
  # @param case_id [Integer] Case id for API URL
  # @param try_number [Integer, nil] Try number for Turbo Stream route (optional)
  # @param can_add_queries [Boolean] If false, form is disabled (e.g. static search engine)
  # @param placeholder [String] Input placeholder text
  def initialize(case_id:, try_number: nil, can_add_queries: true, placeholder: nil)
    @case_id         = case_id
    @try_number      = try_number
    @can_add_queries = can_add_queries
    @placeholder     = placeholder || default_placeholder
  end

  private

  def default_placeholder
    if @can_add_queries
      'Add a query to this case'
    else
      'Adding queries is not supported'
    end
  end
end
