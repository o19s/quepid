# frozen_string_literal: true

class ApplicationResponder < ActionController::Responder
  self.error_status = :unprocessable_content
  self.redirect_status = :see_other
end
