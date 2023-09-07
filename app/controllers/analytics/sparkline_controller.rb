# frozen_string_literal: true

require 'csv'
module Analytics
  class SparklineController < ApplicationController
    layout 'analytics'

    def show
    end

    def vega_specification
    end

    def vega_data
      @scores = []
      @current_user.cases_involved_with.not_archived.recent.limit(8).each do |kase|
        @scores << kase.scores.sampled(kase.id, 100)
      end
      @scores.flatten!
    end
  end
end
