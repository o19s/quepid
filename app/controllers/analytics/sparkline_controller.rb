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
      @scores = Score.where(case_id: @current_user.cases.not_archived.select(:id)).includes([ :case ])
    end
  end
end
