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

          # rubocop:disable Metrics/MethodLength
          # rubocop:disable Metrics/AbcSize
          # rubocop:disable Metrics/CyclomaticComplexity
          # rubocop:disable Metrics/PerceivedComplexity
          # rubocop:disable Metrics/BlockLength

          def show
            puts "Here we have case named #{@case.case_name}"

          end



          # rubocop:enable Metrics/MethodLength
          # rubocop:enable Metrics/AbcSize
          # rubocop:enable Metrics/CyclomaticComplexity
          # rubocop:enable Metrics/PerceivedComplexity
          # rubocop:enable Metrics/BlockLength

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
