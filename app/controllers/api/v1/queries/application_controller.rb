# frozen_string_literal: true

module Api
  module V1
    module Queries
      class ApplicationController < ::Api::ApiController
        before_action :set_case
        before_action :set_case_query
      end
    end
  end
end
