# frozen_string_literal: true

module Admin
  class QueryRunnerController < ApplicationController
    before_action :set_case, only: [ :run_queries ]

    def index
    end

    def run_queries
      @case = Case.find(params['case_id']) # any case is accessible!
      @try = @case.tries.where(try_number: params['try_number']).first
      QueryRunnerJob.perform_later @case, @try
      redirect_to admin_query_runner_index_path,
                  notice: "Query Runner Job was queued up for case id #{@case.id} / #{@case.case_name} and try #{@try.name}."
    end
  end
end
