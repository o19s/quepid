# frozen_string_literal: true

module NotificationsManager
  extend ActiveSupport::Concern

  private

  def email_notifications_enabled?
    Rails.application.config.action_mailer.delivery_method.present?
  end

  def check_email
    unless email_notifications_enabled?
      redirect_to sessions_path, alert: "Email delivery hasn't been set up, so can't send reset password email."
    end
  end
end
