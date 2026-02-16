# frozen_string_literal: true

module Api
  module V1
    module Clone
      class CasesController < Api::ApiController
        before_action :set_case
        before_action :check_case

        def create
          @new_case = Case.new

          preserve_history    = params[:preserve_history]
          clone_queries       = params[:clone_queries]
          clone_ratings       = params[:clone_ratings]
          the_try             = @case.tries.where(try_number: params[:try_number]).first
          @new_case.case_name = params[:case_name].presence || "Cloned: #{@case.case_name}"

          transaction = @new_case.clone_case(
            @case,
            current_user,
            try:              the_try,
            preserve_history: preserve_history,
            clone_queries:    clone_queries,
            clone_ratings:    clone_ratings
          )

          if transaction
            respond_with @new_case
          else
            render status: :bad_request
          end
        end
      end
    end
  end
end
