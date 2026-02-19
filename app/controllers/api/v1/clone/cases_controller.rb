# frozen_string_literal: true

module Api
  module V1
    module Clone
      class CasesController < Api::ApiController
        before_action :set_case
        before_action :check_case

        def create
          @new_case = Case.new
          cp = clone_params

          preserve_history    = deserialize_bool_param(cp[:preserve_history])
          clone_queries       = deserialize_bool_param(cp[:clone_queries])
          clone_ratings       = deserialize_bool_param(cp[:clone_ratings])
          the_try             = @case.tries.where(try_number: cp[:try_number]).first
          @new_case.case_name = cp[:case_name].presence || "Cloned: #{@case.case_name}"

          return render json: { error: 'Must select a try or include full history' }, status: :bad_request if !preserve_history && the_try.nil?

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
            render json: { error: 'Clone failed' }, status: :bad_request
          end
        end

        private

        def clone_params
          params.permit(:case_id, :case_name, :try_number, :preserve_history, :clone_queries, :clone_ratings)
        end
      end
    end
  end
end
