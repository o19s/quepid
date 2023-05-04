# frozen_string_literal: true

module Analytics
  module Cases
    class VisibilitiesController < ApplicationController
      before_action :set_case, only: [ :update ]

      def update
        if @case.public?
          @case.mark_private
        else
          @case.mark_public
        end

        @case.save

        Analytics::Tracker.track_case_updated_event current_user, @case
        redirect_to analytics_tries_visualization_path(@case)
      end
    end
  end
end
