module Api
  module V1
    class RawContentsController < Api::ApiController
      before_action :find_case
      before_action :check_case
      before_action :set_try, only: [ :show, :update, :destroy ]


      def set_try

        # DO WE USE THE INTERNAL TRY_ID??????????????????????????????
        # We always refer to a try as a incrementing linear number within the scope of
        # a case.   We don't use the internal try_id in the API.
        @try = @case.tries.where(try_number: params[:try_number]).first

        render json: { message: 'Try not found!' }, status: :not_found unless @try
      end
    end
  end
end
