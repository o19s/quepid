# frozen_string_literal: true

# Concern for validating that an options field contains valid JSON
# Used by models that have a :json options field that can accept JSON strings
#
# Usage:
#   include JsonOptionsValidatable
#
module JsonOptionsValidatable
  extend ActiveSupport::Concern

  included do
    validate :validate_options_is_valid_json
  end

  private

  def validate_options_is_valid_json
    return if options.nil?

    # If options is a String, try to parse it as JSON
    JSON.parse(options) if options.is_a?(String)
    # If it's already a Hash, Array, or other JSON-compatible type, it's valid
  rescue JSON::ParserError => e
    errors.add(:options, "must be valid JSON: #{e.message}")
  end
end
