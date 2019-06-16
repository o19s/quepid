# frozen_string_literal: true

module Api
  module V1
    class CurrentUserController < Api::ApiController
      def show
        @user = CurrentUserDecorator.new(current_user)
        respond_with @user
      end
    end
  end
end
