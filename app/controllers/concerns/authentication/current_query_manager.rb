# frozen_string_literal: true

module Authentication
  module CurrentQueryManager
    extend ActiveSupport::Concern

    private

    def set_case_query
      @query = @case.queries.where(id: params[:query_id]).first
    end

    def set_query
      @query = @case.queries.where(id: params[:id]).first
    end

    def check_query
      render json: { message: 'Query not found!' }, status: :not_found unless @query
    end
  end
end
