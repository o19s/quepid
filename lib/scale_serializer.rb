# frozen_string_literal: true

# Used by the scorer model to serialize users scale options into a simple string
# for storage in the db
class ScaleSerializer
  def self.dump scale
    if scale.is_a? Array
      scale.join(',')
    elsif scale.is_a? String
      scale
    end
  end

  def self.load scale
    # TODO: escape ',' in labels
    return unless scale

    scale.split(',').map { |i| Integer(i) }.sort
  rescue ArgumentError
    raise ActiveRecord::SerializationTypeMismatch, 'Scale should be an array of integers'
  end
end
