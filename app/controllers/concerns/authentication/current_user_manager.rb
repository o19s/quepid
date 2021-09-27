# frozen_string_literal: true

module Authentication
  module CurrentUserManager
    extend ActiveSupport::Concern

    included do
      helper_method :current_user
    end

    private

    def current_user
      @current_user
    end

    def authenticate_api!
      return true if current_user

      render json:   { reason: 'Unauthorized!' },
             status: :unauthorized
    end

    def check_current_user_locked!
      return true unless current_user&.locked?

      clear_user_session
      self.status = :unauthorized
      self.response_body = { reason: 'Locked' }.to_json
    end

    def set_current_user
      if @current_user.present?
        session[:current_user_id] = @current_user.id
        return
      end

      if session[:current_user_id] && User.exists?(session[:current_user_id])
        @current_user = User.find(session[:current_user_id])
      else
        clear_user_session
      end
    end

    def require_login
      unless @current_user
        # check if we are redirected from the case page, and if so lets support unfurling
        # by populating the flash so it renders in the start.html.erb layout.
        if params[:controller] == 'home' && params[:action] == 'index' && params[:id]
          #puts "Setting up unfurl for case #{params[:id]}"
          #flash[:unfurl] = Case.find_by_id(params[:id])
          redirect_to new_session_path, @case_id = params[:id]
        else
          redirect_to new_session_path
        end
      end
    end

    def auto_login user
      @current_user = user
    end

    def clear_user_session
      @current_user             = nil
      session[:current_user_id] = nil
    end
  end
end
