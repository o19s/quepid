# frozen_string_literal: true

module Authentication
  module CurrentQueryManager
    extend ActiveSupport::Concern

    private

    def set_case_query
      @query = @case.queries.find(params.expect(:query_id))
    end

    def set_query
      @query = @case.queries.find(params.expect(:id))
    end
  end
end
