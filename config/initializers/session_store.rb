# frozen_string_literal: true

# Be sure to restart your server when you modify this file.
#puts "APPARENTLY I AM NOT NEED\n\n\n"
Rails.application.config.session_store :cookie_store, key: '_quepid_session', same_site: :lax
