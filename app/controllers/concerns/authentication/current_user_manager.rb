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
      redirect_to secure_path unless @current_user
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
