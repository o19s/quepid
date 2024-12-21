# frozen_string_literal: true

module Admin
  class RunCaseController < ApplicationController
    before_action :set_case, only: [ :run_case ]

    def index
    end

    # rubocop:disable Layout/LineLength
    def run_case
      @case = Case.find(params['case_id']) # any case is accessible!
      @try = @case.tries.where(try_number: params['try_number']).first
      RunCaseJob.perform_later @case, @try
      redirect_to admin_run_case_index_path,
                  notice: "Run Case Job was queued up for case id #{@case.id} / #{@case.case_name} and try #{@try.name}."
    end
    # rubocop:enable Layout/LineLength
  end
end
