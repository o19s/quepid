# frozen_string_literal: true

# Custom validator for JSON format validation
# Validates that a field contains valid JSON as a Hash/object (not arrays or primitives)
#
# Usage in models:
#   validates :options, json_format: true, allow_blank: true
#   validates :custom_headers, json_format: { normalize_values: true }, allow_blank: true
#
# Options:
#   normalize_values: true - Normalizes all values to strings (useful for HTTP headers)
#                           Converts numbers, booleans, nil to strings
#                           Joins arrays with ', '
#
# The validator will:
# - Accept nil values (when allow_blank: true)
# - Accept blank strings (when allow_blank: true)
# - Accept valid JSON hashes/objects
# - Reject JSON arrays or primitive values (must be key-value pairs)
# - Accept valid JSON strings that parse to a Hash
# - Optionally normalize all values to strings when normalize_values: true
# - Reject invalid JSON strings with a descriptive error message
#
class JsonFormatValidator < ActiveModel::EachValidator
  def validate_each record, attribute, value
    return if value.blank?

    raw_value = record.read_attribute_before_type_cast(attribute)

    if raw_value.is_a?(String) && raw_value.present?
      validate_json_string(record, attribute, raw_value)
    elsif !value.nil? && !value.is_a?(Hash)
      record.errors.add(attribute, 'must be a JSON object')
    elsif value.is_a?(Hash) && options[:normalize_values]
      apply_normalization(record, attribute, value)
    end
  end

  private

  # Validate a JSON string value
  def validate_json_string record, attribute, raw_value
    parsed = JSON.parse(raw_value)

    unless parsed.is_a?(Hash)
      record.errors.add(attribute, 'must be a JSON object (e.g., {"key": "value"}), not an array or primitive value')
      return
    end

    apply_normalization_or_assign(record, attribute, parsed)
  rescue JSON::ParserError => e
    record.errors.add(attribute, options[:message] || "must be valid JSON: #{e.message}")
  end

  # Apply normalization if requested, otherwise just assign the parsed value
  def apply_normalization_or_assign record, attribute, parsed
    if options[:normalize_values]
      apply_normalization(record, attribute, parsed)
    else
      record.send("#{attribute}=", parsed)
    end
  end

  # Normalize and assign values
  def apply_normalization record, attribute, hash
    normalized = normalize_values(record, attribute, hash)
    record.send("#{attribute}=", normalized) if normalized
  end

  # Normalize all values to strings
  # Useful for HTTP headers which must be strings
  def normalize_values record, attribute, hash
    normalized = hash.transform_values do |value|
      case value
      when String
        value
      when Numeric, TrueClass, FalseClass, NilClass
        value.to_s
      when Array
        value.map(&:to_s).join(', ')
      else
        record.errors.add(attribute, "values must be strings, numbers, booleans, or arrays (got #{value.class})")
        value.to_s
      end
    end

    normalized
  end
end
