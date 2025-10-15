# frozen_string_literal: true

require 'csv'

module Api
  module V1
    module Export
      module Queries
        class InformationNeedsController < Api::ApiController
          before_action :set_case
          before_action :check_case

          def show
          end
        end
      end
    end
  end
end
