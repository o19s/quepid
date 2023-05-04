# frozen_string_literal: true

# Make email sending possible over smtp and configurable via env vars.
if Rails.application.config.email_provider.casecmp?('smtp')
  Rails.application.config.action_mailer.delivery_method = :smtp
  Rails.application.config.action_mailer.smtp_settings = {
    address:              ENV.fetch('SMTP_HOST', nil),
    port:                 ENV.fetch('SMTP_PORT', nil),
    domain:               ENV.fetch('MAIL_DOMAIN', nil),
    user_name:            ENV.fetch('SMTP_USERNAME', nil),
    password:             ENV.fetch('SMTP_PASSWORD', nil),
    authentication:       ENV.fetch('SMTP_AUTHENTICATION_TYPE', nil),
    enable_starttls_auto: ENV.fetch('SMTP_ENABLE_STARTTLS', nil),
  }
elsif Rails.application.config.email_provider.casecmp?('postmark')
  Rails.application.config.action_mailer.delivery_method = :postmark
  Rails.application.config.action_mailer.postmark_settings = {
    api_token: ENV.fetch('POSTMARK_API_TOKEN', nil),
  }

end
