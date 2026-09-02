# frozen_string_literal: true

module Analytics
  class TriesVisualizationController < ApplicationController
    layout 'analytics'

    skip_before_action :require_login # we allow anonymous users.   Not the best way to do this ;-)
    before_action :set_case, only: [ :show, :vega_specification, :vega_data ]
    before_action :render_404_page_unless_case, only: [ :show ]
    before_action :check_case, only: [ :vega_specification, :vega_data ]

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

    private

    # @case is nil when the case doesn't exist, or isn't public/accessible to
    # this (possibly anonymous) visitor. Render the standard 404 page instead
    # of letting the view crash on a nil @case.
    def render_404_page_unless_case
      # layout: false -- the 'analytics' layout itself assumes @case is
      # present (e.g. @case.public?), so skip it rather than crash again
      # while trying to render the "not found" response.
      render file: 'public/404.html', status: :not_found, layout: false unless @case
    end
  end
end
