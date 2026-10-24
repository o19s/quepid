# frozen_string_literal: true

module Users
  class SignupsController < ApplicationController
    skip_before_action :require_login

    def create
      user_params_to_save = user_params

      @user = User.build_for_signup(user_params_to_save)

      if @user.save
        session[:current_user_id] = @user.id # not sure if we need to do more here?
        Analytics::Tracker.track_signup_event @user
        redirect_to root_path
      else
        render template: 'sessions/new'
      end
    end

    private

    def user_params
      params.expect(
        user: [ :name,
                :email,
                :password,
                :password_confirmation,
                :agreed,
                :email_marketing ]
      )
    end
  end
end
