# frozen_string_literal: true

Apipie.configure do |config|
  config.app_name                = 'Quepid'
  config.api_base_url            = ''
  config.doc_base_url            = '/apipie'
  config.validate                = :explicitly
  # where is your API defined?
  config.api_controllers_matcher = Rails.root.join('app/controllers/api/**/*.rb').to_s
  config.namespaced_resources    = true
  config.app_info                = "Give your queries some ❤️.  This documentation is a work in progress, we're looking for folks to contribute more annotation of the APIs!"
end
# rubocop:enable Layout/LineLength
