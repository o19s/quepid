# frozen_string_literal: true

class JsonValidator < ActiveModel::EachValidator
  def validate_each record, attribute, value
    # ignore any Hash's that we get, they are already jsonable.
    JSON.parse(value) if value.present? && value.is_a?(String)
  rescue JSON::ParserError
    record.errors.add(attribute, 'must be valid JSON')
  end
end
