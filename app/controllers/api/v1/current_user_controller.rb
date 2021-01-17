# frozen_string_literal: true

module Api
  module V1
    class CurrentUserController < Api::ApiController
      def show
        @permissions = PermissionsEvaluator.new(current_user).run
        @user = current_user

        respond_with @user
      end
    end
  end
end
