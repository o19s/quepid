# frozen_string_literal: true

module Analytics
  class TriesVisualizationController < ApplicationController
    layout 'analytics'

    skip_before_action :require_login # we allow anonymous users.   Not the best way to do this ;-)
    before_action :set_case, only: [ :show, :vega_specification, :vega_data ]

    def show
    end

    def vega_specification
    end

    def vega_data
      @tries = @case.tries.to_a
      try_ids = @tries.to_set(&:id)
      # Imported/cloned tries can retain ancestry outside this case. The chart
      # can only link parents included in its own data; render these as roots.
      @tries.each { |t| t.parent = nil unless try_ids.include?(t.parent_id) }
      roots = @tries.select { |t| t.parent_id.nil? }
      if roots.size > 1 # multiple roots need a new ROOT!
        root_try = Try.new(id: 0, name: 'ROOT')
        roots.each { |t| t.parent = root_try }
        @tries << root_try
      end
    end
  end
end
