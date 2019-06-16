# frozen_string_literal: true

module Api
  module V1
    class UsersController < Api::ApiController
      before_action :set_user, except: [ :index ]

      def index
        @users = []
        if params[:prefix]
          prefix = params[:prefix].downcase
          @users = User.where('username LIKE :prefix OR name LIKE :prefix', prefix: "#{prefix}%").limit(8)
        end
        respond_with @users
      end

      def show
        respond_with @user
      end

      def update
        update_params = user_params

        update_params[:scorer_id] = nil if user_scorer_removed? update_params

        update_params[:default_scorer_id] = nil if default_scorer_removed? update_params

        if @user.update update_params
          respond_with @user
        else
          render json: @user.errors, status: :bad_request
        end
      end

      private

      def set_user
        @user = User.where.any_of(username: params[:id], id: params[:id]).first
        render json: { message: 'User not found!' }, status: :not_found unless @user
      end

      def user_params
        params.require(:user).permit(
          :scorer_id,
          :firstLogin,
          :company,
          :default_scorer_id
        )
      end

      def user_scorer_removed? params = {}
        params[:scorer_id].present? && [ 0, '0' ].include?(params[:scorer_id])
      end

      def default_scorer_removed? params = {}
        params[:default_scorer_id].present? && [ 0, '0' ].include?(params[:default_scorer_id])
      end
    end
  end
end
