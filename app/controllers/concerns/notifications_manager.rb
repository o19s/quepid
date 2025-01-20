# frozen_string_literal: true

module NotificationsManager
  extend ActiveSupport::Concern

  private

  def email_notifications_enabled?
    Rails.application.config.action_mailer.delivery_method.present?
  end

  def check_email
    unless email_notifications_enabled?
      admins = User.where(administrator: true).limit(3)
      alert = "Email delivery hasn't been set up, so can't send reset password email."
      if admins.present?
        alert += ' Please contact the following administrators for help: '
        admins_info = admins.pluck(:name, :email).map do |admin|
          "#{admin[0]} (#{admin[1]})"
        end
        alert += admins_info.to_sentence
      end
      redirect_to sessions_path, alert: alert
    end
  end
end
