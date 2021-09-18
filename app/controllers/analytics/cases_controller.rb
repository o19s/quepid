# frozen_string_literal: true

module Analytics

  # maybe should be elsewhere, or more nested like /analytics/cases/1/tries/history
  class CasesController < ::ApplicationController
    layout 'account'

    before_action :set_case, only: [ :show ]

    def show;

    end


  end
end
