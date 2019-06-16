# frozen_string_literal: true

module Users
  class PasswordsController < Devise::PasswordsController
    force_ssl if: :ssl_enabled?
    skip_before_action :require_login
    skip_before_action :require_no_authentication

    layout 'secure'

    # GET /resource/password/new
    # def new
    #   super
    # end

    # POST /resource/password
    # def create
    #   super
    # end

    # GET /resource/password/edit?reset_password_token=abcdef
    # def edit
    #   super
    # end

    # PUT /resource/password
    # def update
    #   super
    # end

    protected

    def after_resetting_password_path_for _resource
      root_path
    end

    # The path used after sending reset password instructions
    def after_sending_reset_password_instructions_path_for _resource_name
      root_path
    end
  end
end
