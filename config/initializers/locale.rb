# frozen_string_literal: true

# config/initializers/locale.rb

# Where the I18n library should search for translation files
# I18n.load_path += Dir[Rails.root.join('lib', 'locale', '*.{rb,yml}')]
# I18n.load_path += Dir[Rails.root.join('config', 'locales', '*.{rb,yml}')]

# the below shouldn't be needed, but is.
I18n.load_path += Dir[Rails.root.join('config/locales/models/*.{rb,yml}')]

# Permitted locales available for the application
I18n.available_locales = [ :en ]

# Set default locale to something other than :en
I18n.default_locale = :en
