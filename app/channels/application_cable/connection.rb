# frozen_string_literal: true

module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      self.current_user = User.find_by(id: request.session[:current_user_id])
      reject_unauthorized_connection unless current_user && !current_user.locked?
    end
  end
end
