# frozen_string_literal: true

module Analytics
  class TriesVisualizationController < ApplicationController
    layout 'analytics'

    before_action :set_case, only: [ :show, :vega_specification, :vega_data ]

    def show
    end

    def vega_specification
    end

    def vega_data
      @tries = @case.tries

      roots = @tries.select { |t| t.parent.nil? }
      if roots.size > 1 # multiple roots need a new ROOT!
        root_try = Try.new(id: 1, name: 'ROOT')
        @tries.select { |t| t.parent.nil? }.each { |t| t.parent = root_try }
        @tries = [ @tries, root_try ].flatten
      end
    end
  end
end
