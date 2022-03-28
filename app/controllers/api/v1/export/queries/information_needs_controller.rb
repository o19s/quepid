# frozen_string_literal: true

require 'csv'

module Api
  module V1
    module Export
      module Queries
        class InformationNeedsController < Api::ApiController
          before_action :find_case
          before_action :check_case

          def make_csv_safe str
            if str && %w[- = + @].include?(str[0])
              " #{str}"
            else
              str
            end
          end

          def show
            puts "Here we have case named #{@case.case_name}"
          end

          # https://stackoverflow.com/questions/5608918/pad-an-array-to-be-a-certain-size
          # rubocop:disable Naming/MethodParameterName
          def padright! a, n, x
            a.fill(x, a.length...n)
          end
          # rubocop:enable Naming/MethodParameterName
        end
      end
    end
  end
end
