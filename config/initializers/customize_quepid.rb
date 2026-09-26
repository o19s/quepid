# frozen_string_literal: true

# Be sure to restart your server when you modify this file.

# This file checks for various customization options passed in as environment
# variables.

bool = ActiveRecord::Type::Boolean.new

# == Quepid Version
# What version of Quepid is this?
#
Rails.application.config.quepid_version = ENV.fetch('QUEPID_VERSION', 'UNKNOWN')

# == Quepid Default Scorer
# New users to Quepid need to have a recommended scorer to use, which they can then
# override to their own preferred scorer, either one of the defaults shipped with Quepid
# or a custom scorer.
#
Rails.application.config.quepid_default_scorer = ENV.fetch('QUEPID_DEFAULT_SCORER', 'AP@10')

# == Email Marketing Permission
# To comply with GDPR, and be a good citizen, the hosted version of Quepid asks
# if they are willing to receive Quepid related updates via email.  This feature
# isn't useful to private installs, so this controls the display.
#
Rails.application.config.email_marketing_mode = bool.deserialize(ENV.fetch('EMAIL_MARKETING_MODE', false))

# == Cookies Policy URL
# To comply with GDPR, and be a good citizen, the hosted version of Quepid asks
# about cookies and provides a link to the cookies policy. This feature
# isn't useful to private installs, so this controls the display.
#
Rails.application.config.cookies_url = ENV.fetch('COOKIES_URL', nil)

# == Privacy Policy URL
# To comply with GDPR, and be a good citizen, the hosted version of Quepid links
# to a privacy policy. This feature isn't useful to private installs, so this
# controls the display.
#
Rails.application.config.privacy_url = ENV.fetch('PRIVACY_URL', nil)

# == Hosted Go.quepidapp.com T&C's
# Users of the free hosted go.quepidapp.com are asked to agree to certain terms &
# conditions. This feature isn't useful to private installs, so this
# controls the display.
#
Rails.application.config.terms_and_conditions_url = ENV.fetch('TC_URL', nil)

# == Enable signup
# This parameter controls whether or not signing up via the UI is enabled.
Rails.application.config.signup_enabled = bool.deserialize(ENV.fetch('SIGNUP_ENABLED', true))

# == Enable email/password based login
# This parameter controls whether or not signing in using email/password is supported
Rails.application.config.email_login_enabled = bool.deserialize(ENV.fetch('EMAIL_LOGIN_ENABLED', true))

# The packaged macOS application enables Desktop Mode explicitly. Normal
# hosted and Docker deployments retain the existing account behavior.
Rails.application.config.desktop_mode = bool.deserialize(ENV.fetch('QUEPID_DESKTOP_MODE', false))
Rails.application.config.desktop_user_id = ENV['QUEPID_DESKTOP_USER_ID'].presence
Rails.application.config.desktop_user_name = ENV['QUEPID_DESKTOP_USER_NAME'].presence

# == Communal Scorers Only
# Users can normally create custom scorers which run embedded javascript, this is a potential
# security flaw as malicious javascript could be entered. This setting restricts users to
# communal scorers only, which are controlled by admins.
#
Rails.application.config.communal_scorers_only = bool.deserialize(ENV.fetch('COMMUNAL_SCORERS_ONLY', false))

# == What Email Provider to Use
# You can send emails to users using either the Postmark Saas service by setting this to POSTMARK, or
# you can send using traditional SMTP server by setting this to SMTP.  Leave it blank and there is
# no email provider.
Rails.application.config.email_provider = ENV.fetch('EMAIL_PROVIDER', '')

# == Email Address of the Sender of Emails
# When Quepid sends emails to users, what is the email address of the sender?
Rails.application.config.email_sender = ENV.fetch('EMAIL_SENDER', '')

# == Query List Sortable
# See https://github.com/o19s/quepid/issues/272 for a bug in expand/collapse that some setups experience.
# This lets you disable the sorting if you experience the bug.
#
Rails.application.config.query_list_sortable = bool.deserialize(ENV.fetch('QUERY_LIST_SORTABLE', true))

# == OAuth Settings =
# We currently support three authentication providers: Google, Keycloak, and OpenID Connect.
Rails.application.config.google_client_id = ENV.fetch('GOOGLE_CLIENT_ID', '')
Rails.application.config.google_client_secret = ENV.fetch('GOOGLE_CLIENT_SECRET', '')

Rails.application.config.keycloak_realm = ENV.fetch('KEYCLOAK_REALM', '')
Rails.application.config.keycloak_site = ENV.fetch('KEYCLOAK_SITE', '')

# == OpenID Connect Settings =
# All 4 of these settings are required for OpenID Connect authentication to work properly.
# OPENID_CONNECT_BASE_URL should be the protocol and domain that Quepid is running under, e.g. https://example.com or http://localhost:3000 . This is not provided by your OpenID Connect provider, but is needed for Quepid to know how to construct the callback URL for OpenID Connect. It should not have a trailing slash.
Rails.application.config.openid_connect_base_url = ENV.fetch('OPENID_CONNECT_BASE_URL', '')
# Provided by your OpenID Connect provider when you register your application with them.
Rails.application.config.openid_connect_client_id = ENV.fetch('OPENID_CONNECT_CLIENT_ID', '')
# Provided by your OpenID Connect provider when you register your application with them. This should be considered secret and not committed to source control.
Rails.application.config.openid_connect_client_secret = ENV.fetch('OPENID_CONNECT_CLIENT_SECRET', '')
# Provided by your OpenID Connect provider when you register your application with them.
Rails.application.config.openid_connect_issuer = ENV.fetch('OPENID_CONNECT_ISSUER', '')
# Optional value for your OpenID Connect Signin Button
Rails.application.config.openid_connect_button_text = ENV.fetch('OPENID_CONNECT_BUTTON_TEXT', 'Sign in with OpenID Connect')

# == Domain Quepid is Running Under
# Certain features, like sending emails and Google Analytics require you to set the domain that Quepid
# is set up under.
Rails.application.config.quepid_domain = ENV.fetch('QUEPID_DOMAIN', '')

# == Ollama Service URL
# The development Docker stack listens on port 31434; production's Docker
# stack uses the standard Ollama port. Override this with OLLAMA_SERVICE_URL
# when Rails runs directly on the host or uses a custom Ollama deployment.
Rails.application.config.ollama_service_url = ENV.fetch('OLLAMA_SERVICE_URL', Rails.env.production? ? 'http://ollama:11434' : 'http://ollama:31434')

# == If we have nested Quepid under a context, like tools.bigcorp.com/quepid then this deal with that situation.
Rails.application.config.action_cable.url = "#{ENV.fetch('RAILS_RELATIVE_URL_ROOT', '')}/cable"

# == Search Endpoint Views Admin Only
# When enabled, only administrators can access the Search Endpoints management views
# (index, show, edit, mapper wizard). Regular users will be redirected.
# This is useful for organizations that want to centrally manage search endpoints.
#
Rails.application.config.search_endpoint_views_admin_only = bool.deserialize(ENV.fetch('SEARCH_ENDPOINT_VIEWS_ADMIN_ONLY', false))

# == Require Proxy with Basic Auth Credentials
# When enabled, endpoints with basic auth credentials must use proxy_requests.
# This ensures credentials are handled server-side rather than exposed to the browser.
# Credentials are always masked in the UI regardless of this setting.
#
Rails.application.config.require_proxy_with_basic_auth_credentials = bool.deserialize(ENV.fetch('REQUIRE_PROXY_WITH_BASIC_AUTH_CREDENTIALS', false))

# == Require Proxy for All Search Endpoints
# When enabled, every search endpoint must use proxy_requests, regardless of
# basic auth credentials. Useful when the client (e.g. an embedded WebView)
# should never make direct network requests to a user-configured endpoint.
#
Rails.application.config.require_proxy_for_all_search_endpoints = bool.deserialize(ENV.fetch('REQUIRE_PROXY_FOR_ALL_SEARCH_ENDPOINTS', false))

# NOTE: ActiveRecord encryption keys are configured in config/application.rb so
# they take effect before the active_record.encryption Railtie initializer runs.
# We provide some defaults, but you should set your own keys and NOT lose them.

# rubocop:disable-next Metrics/BlockLength
Rails.application.config.after_initialize do
  next if defined?(Rails::Console)

  # Run only on server start.
  #
  # Loads matching endpoints once and reuses that array for both the emptiness
  # check and the listing below, and warns about any that will fail validation.
  warn_about_endpoints_needing_proxy = lambda do |flag_name, scope_builder, detail|
    endpoints = scope_builder.call.to_a
    next if endpoints.empty?

    Rails.logger.warn '=' * 80
    Rails.logger.warn "WARNING: #{flag_name} is enabled"
    Rails.logger.warn detail
    endpoints.each { |endpoint| Rails.logger.warn "  - #{endpoint.name} (ID: #{endpoint.id})" }
    Rails.logger.warn 'These endpoints will fail validation when edited.'
    Rails.logger.warn "Enable proxy_requests for these endpoints or set #{flag_name}=false"
    Rails.logger.warn '=' * 80
  rescue ActiveRecord::StatementInvalid, ActiveRecord::NoDatabaseError
    # Database might not be set up yet, skip check
  end

  # The all-endpoints check below already covers every endpoint the
  # basic-auth-only check would find, so only run one of them.
  if Rails.application.config.require_proxy_for_all_search_endpoints
    warn_about_endpoints_needing_proxy.call(
      'REQUIRE_PROXY_FOR_ALL_SEARCH_ENDPOINTS',
      -> { SearchEndpoint.where(proxy_requests: false) },
      'The following search endpoints have proxy_requests disabled:'
    )
  elsif Rails.application.config.require_proxy_with_basic_auth_credentials
    warn_about_endpoints_needing_proxy.call(
      'REQUIRE_PROXY_WITH_BASIC_AUTH_CREDENTIALS',
      -> { SearchEndpoint.where.not(basic_auth_credential: nil).where(proxy_requests: false) },
      'The following search endpoints have basic auth credentials but proxy_requests disabled:'
    )
  end
end
