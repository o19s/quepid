# frozen_string_literal: true

require 'csv'
module Analytics
  class SparklineController < Api::ApiController
    layout 'analytics'

    def show
    end

    def vega_specification
    end

    def vega_data
      @scores = []
      recent_cases(8).each do |kase|
        @scores << kase.scores.sampled(kase.id, 100)
      end
      @scores.flatten!
    end
  end
end
