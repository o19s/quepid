# frozen_string_literal: true

require 'csv'

module Api
  module V1
    module Export
      module Queries
        class InformationNeedsController < Api::ApiController
          before_action :set_case

          def show
            rows = [ %w[query information_need] ] +
                   @case.queries.map { |query| [ query.query_text, query.information_need ] }
            send_data CsvExport.generate(rows), type: 'text/csv', disposition: 'inline'
          end
        end
      end
    end
  end
end
