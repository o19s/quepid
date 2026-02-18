# frozen_string_literal: true

# Renders the "Compare results" (diff) trigger and modal for selecting 1-3 snapshots
# to compare against current search results. Works with the diff Stimulus controller.
# Replaces the Angular diff component. Applying selection dispatches a custom event
# for the results view to consume; actual diff display is in the results/matches area
# (migrated separately).
#
# API: GET api/cases/:case_id/snapshots?shallow=true, DELETE api/cases/:case_id/snapshots/:id
#
# @see docs/view_component_conventions.md
class DiffComponent < ApplicationComponent
  MAX_SNAPSHOTS = 3

  # @param case_id [Integer] Case id (for snapshots API)
  def initialize(case_id:)
    @case_id = case_id
  end
end
