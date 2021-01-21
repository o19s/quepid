# frozen_string_literal: true

module Api
  module V1
    module Analytics
      class CasesController < Api::ApiController
        before_action :find_case
        before_action :check_case

        # not sure if this is going to be used or deleted...
        # Currently using a analytics parameter on case show method.
        def show
          respond_with @case
        end
      end
    end
  end
end
