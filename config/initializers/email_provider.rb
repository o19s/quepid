# frozen_string_literal: true

# Make email sending possible over smtp and configurable via env vars.
if Rails.application.config.email_provider.casecmp?('smtp')
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
elsif Rails.application.config.email_provider.casecmp?('postmark')
  Rails.application.config.action_mailer.delivery_method = :postmark
  Rails.application.config.action_mailer.postmark_settings  = {
    api_token: ENV['POSTMARK_API_TOKEN'],
  }

end
