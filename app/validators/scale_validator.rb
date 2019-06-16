# frozen_string_literal: true

class ScaleValidator < ActiveModel::Validator
  def validate record
    return true if record.scale.blank?

    if record.scale.length > 10
      record.errors.add(:scale, :length)
    elsif record.scale.any? { |i| !integer?(i) }
      record.errors.add(:scale, :type)
    end
  end

  def integer? value
    (/\A[-+]?\d+\z/ == value) || value.is_a?(Integer)
  end
end
