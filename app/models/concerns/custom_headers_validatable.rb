# frozen_string_literal: true

# Shared concern for custom_headers validation and normalization
# Include this in models that have a custom_headers attribute with serialize :custom_headers, coder: JSON
#
# This ensures HTTP headers are always stored as Hash with string values
# and provides validation for JSON format and structure.
#
# Example usage:
#   class SearchEndpoint < ApplicationRecord
#     serialize :custom_headers, coder: JSON
#     include CustomHeadersValidatable
#   end
#
module CustomHeadersValidatable
  extend ActiveSupport::Concern

  included do
    validate :validate_custom_headers_format
  end

  private

  # rubocop:disable Metrics/CyclomaticComplexity
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/PerceivedComplexity
  def validate_custom_headers_format
    return if custom_headers.blank?

    # When using serialize with JSON coder, Rails handles valid JSON automatically
    # We just need to validate that it's a Hash (JSON object) and not an array or primitive
    # We also need to catch invalid JSON strings before they cause serialization errors

    # Get the raw value before serialization to check if it's a string
    raw_value = read_attribute_before_type_cast(:custom_headers)

    if raw_value.is_a?(String) && raw_value.present?
      # Validate the JSON string format
      begin
        parsed = JSON.parse(raw_value)
        unless parsed.is_a?(Hash)
          errors.add(:custom_headers, 'must be a JSON object (e.g., {"key": "value"}), not an array or primitive value')
          return
        end

        # Normalize all header values to strings (HTTP headers must be strings)
        normalized = normalize_header_values(parsed)
        self.custom_headers = normalized
      rescue JSON::ParserError => e
        errors.add(:custom_headers, "must be valid JSON: #{e.message}")
      end
    elsif !custom_headers.nil? && !custom_headers.is_a?(Hash)
      # If it's already deserialized but not a Hash, reject it
      errors.add(:custom_headers, 'must be a JSON object')
    elsif custom_headers.is_a?(Hash)
      # Normalize header values if it's already a Hash
      self.custom_headers = normalize_header_values(custom_headers)
    end
  end
  # rubocop:enable Metrics/CyclomaticComplexity
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/PerceivedComplexity

  # Normalize header values to strings
  # HTTP headers must always be strings, not numbers or booleans
  def normalize_header_values headers
    headers.transform_values do |value|
      case value
      when String
        value
      when Numeric, TrueClass, FalseClass, NilClass
        value.to_s
      when Array
        value.map(&:to_s).join(', ')
      else
        errors.add(:custom_headers, "header values must be strings, numbers, booleans, or arrays (got #{value.class})")
        value.to_s
      end
    end
  end
end
