# frozen_string_literal: true

module Api
  module V1
    module Import
      class CasesController < Api::ApiController
        def create
          params_to_use = case_params.to_h.deep_symbolize_keys

          @case = Case.new
          options = {}
          case_importer = ::CaseImporter.new @case, @current_user, params_to_use, options

          case_importer.validate

          unless @case.errors.empty?
            render json: @case.errors, status: :bad_request
            return
          end

          if case_importer.import
            # so annoying to import a case and then have to do the wizard!
            # If you import a case, you presumably know what you are doing.
            @current_user.update completed_case_wizard: true
            respond_with @case
          else
            render json: @case.errors, status: :bad_request
          end
        end

        private

        def case_params
          params.require(:case).permit!
        end
      end
    end
  end
end
