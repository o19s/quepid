# frozen_string_literal: true

module Users
  class InvitationsController < Devise::InvitationsController
    skip_before_action :require_login, only: [ :edit, :update ]

    # Intercepts the login path and redirects the user to their
    # Team page as their first page after joining Quepid!
    def after_accept_path_for resource
      teams_url(resource.teams.first)
    end

    # rubocop:disable Lint/UselessMethodDefinition
    def edit
      super
    end

    def update
      unless signup_enabled?
        flash.now[:error] = 'Signups are disabled.'
        redirect_to sessions_path and return
      end

      super

      @user.agreed_time = Time.zone.now
      session[:current_user_id] = @user.id
      Analytics::Tracker.track_signup_event @user
    end

    # rubocop:enable Lint/UselessMethodDefinition

    private

    def update_resource_params
      params.expect(
        user: [ :name,
                :email,
                :invitation_token,
                :password,
                :password_confirmation,
                :agreed,
                :email_marketing ]
      )
    end
  end
end
