# frozen_string_literal: true

module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      self.current_user = find_verified_user
    end

    private

    def find_verified_user
      # Try to find user from session
      if (verified_user = User.find_by(id: session['current_user_id']))
        verified_user
      else
        # Reject anonymous connections for chat
        reject_unauthorized_connection
      end
    end

    def session
      # Access session through cookies
      @session ||= cookies.encrypted['_quepid_session']&.with_indifferent_access || {}
    end
  end
end
