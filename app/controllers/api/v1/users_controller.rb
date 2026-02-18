# frozen_string_literal: true

module Api
  module V1
    # @tags users
    class UsersController < Api::ApiController
      before_action :set_user, except: [ :index ]

      # @parameter prefix(query) [String] Filters down the list to users whose email addresses or name start with the prefix.
      def index
        @users = []
        if params[:prefix]
          prefix = params[:prefix].downcase
          @users = User.where('`email` LIKE :prefix',
                              prefix: "#{prefix}%").or(User.where('`name` LIKE :prefix', prefix: "#{prefix}%")).limit(8)
        end
        respond_with @users
      end

      def show
        respond_with @user
      end

      def update
        unless @user == current_user
          render json: { message: "Forbidden" }, status: :forbidden
          return
        end

        update_params = user_params

        update_params[:default_scorer_id] = Scorer.system_default_scorer.id if default_scorer_removed? update_params

        if @user.update update_params
          respond_with @user
        else
          render json: @user.errors, status: :bad_request
        end
      end

      private

      def set_user
        @user = User.where('email = ? OR id = ?', params[:id].to_s.downcase, params[:id] ).first
        render json: { message: 'User not found!' }, status: :not_found unless @user
      end

      def user_params
        params.expect(
          user: [ :completed_case_wizard,
                  :company,
                  :default_scorer_id ]
        )
      end

      def default_scorer_removed? params = {}
        params[:default_scorer_id].present? && [ 0, '0' ].include?(params[:default_scorer_id])
      end
    end
  end
end
