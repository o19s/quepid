# frozen_string_literal: true
require 'csv'
module Analytics
  class SparklineController < ApplicationController
    layout 'analytics'

    skip_before_action :require_login # we allow anonymous users.   Not the best way to do this ;-)
    before_action :set_case, only: [ :show, :vega_specification, :vega_data ]

    def show
    end

    def vega_specification
    end

    def vega_data
      @scores = Score.all
    
    end
  end
end
