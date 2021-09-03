# frozen_string_literal: true

module Users
  class SignupsController < ApplicationController
    skip_before_action :require_login
    layout 'start'

    # rubocop:disable Metrics/MethodLength
    def create
      user_params_to_save = user_params

      # Check if we already have an invite out for this user, and if so let's use that
      if user_params_to_save[:email].blank?
        @user = User.new user_params_to_save
      else
        @user = User.where(email: user_params_to_save[:email]).where.not(invitation_token: nil).first
        if @user
          @user.assign_attributes(user_params_to_save)
        else
          @user = User.new user_params_to_save
          # in this flow, we have a new user joining, so we create a empty case for them, which
          # on the home_controller.rb triggers the bootstrap and the new case wizard.
          @user.cases.build case_name: "Case #{@user.cases.size}"
        end
      end

      respond_to do |format|
        format.html do
          if @user.save
            session[:current_user_id] = @user.id # not sure if we need to do more here?
            Analytics::Tracker.track_signup_event @user
            redirect_to root_path
          else
            render template: 'sessions/new'
          end
        end
        format.js
      end
    end
    # rubocop:enable Metrics/MethodLength

    private

    def user_params
      params.require(:user).permit(
        :name,
        :email,
        :password,
        :password_confirmation,
        :agreed,
        :email_marketing
      )
    end
  end
end
