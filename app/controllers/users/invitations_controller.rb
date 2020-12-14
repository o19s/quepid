# frozen_string_literal: true

module Users
  class InvitationsController < Devise::InvitationsController
    force_ssl if: :ssl_enabled?
    skip_before_action :require_login, only: [ :edit, :update ]

    def update
      unless signup_enabled?
        flash.now[:error] = 'Signups are disabled.'
        redirect_to secure_path and return
      end

      super

      @user.agreed_time = Time.zone.now
      session[:current_user_id] = @user.id
      Analytics::Tracker.track_signup_event @user
    end

    # rubocop:disable Lint/UselessMethodDefinition
    def edit
      super
    end
    # rubocop:enable Lint/UselessMethodDefinition

    private

    def update_resource_params
      params.require(:user).permit(
        :name,
        :email,
        :invitation_token,
        :password,
        :password_confirmation,
        :agreed,
        :email_marketing
      )
    end
  end
end
