# frozen_string_literal: true

module Api
  module V1
    module Export
      class CasesController < Api::ApiController
        api!
        before_action :find_case
        before_action :check_case

        def show
          respond_with @case
        end
      end
    end
  end
end
