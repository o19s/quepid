# frozen_string_literal: true

module Admin
  module Users
    class LocksController < Admin::AdminController
      before_action :set_user

      def update
        if @user.locked?
          @user.unlock
        else
          @user.lock
        end

        @user.save
        redirect_to admin_user_path(@user)
      end

      private

      def set_user
        @user = User.find(params[:user_id])
      end
    end
  end
end
