# frozen_string_literal: true

module Api
  module V1
    module Export
      class CasesController < Api::ApiController
        before_action :set_case
        before_action :check_case

        def show
          respond_with @case
        end
      end
    end
  end
end
