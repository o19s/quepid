# frozen_string_literal: true

# Make mail sending possible over smtp and configurable via env vars.
if ENV['MAIL_METHOD'].present? && 'smtp'.casecmp(ENV['MAIL_METHOD']).zero?
  Rails.application.config.action_mailer.delivery_method = :smtp
  Rails.application.config.action_mailer.smtp_settings = {
    address:              ENV['SMTP_HOST'],
    port:                 ENV['SMTP_PORT'],
    domain:               ENV['MAIL_DOMAIN'],
    user_name:            ENV['SMTP_USERNAME'],
    password:             ENV['SMTP_PASSWORD'],
    authentication:       ENV['SMTP_AUTHENTICATION_TYPE'],
    enable_starttls_auto: ENV['SMTP_ENABLE_STARTTLS'],
  }
end
