# frozen_string_literal: true

module Api
  module V1
    class SignupsController < Api::ApiController
      skip_before_action :authenticate_api!
      skip_before_action :verify_authenticity_token

      def create
        user_params_to_save = user_params
        # Little workaround for the Angular frontend doing password confirmation on the frontend!
        user_params_to_save[:password_confirmation] = user_params_to_save[:password]
        @user = User.new user_params_to_save

        if @user.save
          Analytics::Tracker.track_signup_event @user
          respond_with @user
        else
          render json: @user.errors, status: :bad_request
        end
      end

      private

      def user_params
        params.require(:user).permit(
          :name,
          :email,
          :password,
          :agreed,
          :email_marketing
        )
      end
    end
  end
end
