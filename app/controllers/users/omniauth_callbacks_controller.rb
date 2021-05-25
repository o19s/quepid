# frozen_string_literal: true

module Users
  class OmniauthCallbacksController < Devise::OmniauthCallbacksController
    force_ssl if: :ssl_enabled?
    skip_before_action :require_login, only: [ :keycloakopenid, :google_oauth2, :failure ]

    def keycloakopenid
      Rails.logger.debug(request.env['omniauth.auth'])
      # Examples online suggest that I should have a from_omniauth or find_or_create_from_auth_hash
      # methods injected into my User class by a gem, however I had to manually add mine.
      # @user = User.from_omniauth(request.env["omniauth.auth"])
      # @user = User.find_or_create_from_auth_hash(request.env["omniauth.auth"])
      @user = User.from_omniauth_custom(request.env['omniauth.auth'])
      if @user.persisted?
        session[:current_user_id] = @user.id # this populates our session variable.

        # in this flow, we have a new user joining, so we create a empty case for them, which
        # on the home_controller.rb triggers the bootstrap and the new case wizard.
        @user.cases.build case_name: "Case #{@user.cases.size}"

        # sign_in_and_redirect @user, event: :authentication
        redirect_to root_path
      else
        Rails.logger.warn('user not persisted, what do we need to do?')
        session['devise.keycloakopenid_data'] = request.env['omniauth.auth']
        redirect_to new_user_registration_url
      end
    end

    # rubocop:disable Metrics/AbcSize
    def google_oauth2
      # You need to implement the method below in your model (e.g. app/models/user.rb)
      @user = User.from_omniauth_custom(request.env['omniauth.auth'])
      @user.agreed = true # agreement happens implicitly on this flow.

      if @user.persisted?
        session[:current_user_id] = @user.id # this populates our session variable.

        # in this flow, we have a new user joining, so we create a empty case for them, which
        # on the home_controller.rb triggers the bootstrap and the new case wizard.
        @user.cases.build case_name: "Case #{@user.cases.size}"

        # flash[:notice] = I18n.t 'devise.omniauth_callbacks.success', kind: 'Google'
        redirect_to root_path
        # sign_in_and_redirect @user, event: :authentication
      else
        # Removing extra as it can overflow some session stores
        session['devise.google_data'] = request.env['omniauth.auth'].except('extra')
        redirect_to new_user_registration_url, alert: @user.errors.full_messages.join("\n")
      end
    end
    # rubocop:enable Metrics/AbcSize

    def failure
      redirect_to root_path, alert: 'BOOOOMMMMMMM3' + @user.errors.full_messages.join("\n") + "BLANK" + session['devise.google_data']
    end
  end
end
