# frozen_string_literal: true

module Users
  class OmniauthCallbacksController < Devise::OmniauthCallbacksController
    skip_before_action :require_login, only: [ :keycloakopenid, :google_oauth2, :failure, :openid_connect ]

    def keycloakopenid
      @user = create_user_from_omniauth(request.env['omniauth.auth'])

      @user.errors.add(:base, "Can't log in a locked user." ) if @user.locked
      if @user.persisted? & !@user.locked
        session[:current_user_id] = @user.id # this populates our session variable.

        redirect_to root_path
      else
        session['devise.keycloakopenid_data'] = request.env['omniauth.auth']
        redirect_to new_session
      end
    end

    def google_oauth2
      @user = create_user_from_omniauth(request.env['omniauth.auth'])
      @user.errors.add(:base, "Can't log in a locked user." ) if @user.locked
      if @user.errors.empty?
        session[:current_user_id] = @user.id # this populates our session variable.
        redirect_to root_path
      else
        # Removing extra as it can overflow some session stores
        session['devise.google_data'] = request.env['omniauth.auth'].except('extra')
        redirect_to root_path, alert: @user.errors.full_messages.join("\n") if @user
      end
    end

    def openid_connect
      @user = create_user_from_omniauth(request.env['omniauth.auth'])

      @user.errors.add(:base, "Can't log in a locked user." ) if @user.locked
      Rails.logger.info "User errors after checking for locked status: #{@user.errors.full_messages.join(', ')}"

      if @user.errors.empty?
        session[:current_user_id] = @user.id # this populates our session variable.

        redirect_to root_path
      else
        # Ensure session data is cleared on failed login to prevent issues with subsequent login attempts
        session['devise.openid_connect_data'] = nil
        redirect_to root_path, alert: @user.errors.full_messages.join("\n") if @user
      end
    end

    def failure
      redirect_to root_path, alert: 'Could not sign user in with OAuth provider.'
    end

    private

    def create_user_from_omniauth auth
      if Rails.application.config.signup_enabled
        user = User.find_or_initialize_by(email: auth['info']['email'])
      else
        user = User.find_by(email: auth['info']['email'])
        if user.nil? # we looked for a existing user account and didn't find it
          user = User.new(email: auth['info']['email'])
          user.errors.add(:base, 'You can only sign in with already created users.' )
        end
      end

      user.name = auth['info']['name']
      user.password = 'fake' if user.password.blank? # If you don't have a password, fake it.
      user.agreed = true

      user.num_logins ||= 0
      user.num_logins  += 1

      user.profile_pic = auth['info']['image']
      # user.access_token = auth['credentials']['token']
      # user.refresh_token = auth['credentials']['refresh_token'] unless auth['credentials']['refresh_token'].nil?
      # user.expires_at = auth['credentials']['expires_at'] unless auth['credentials']['refresh_token'].nil?

      if user.errors.empty?
        user.save!
        ahoy.authenticate(user)
      end
      user
    end
  end
end
