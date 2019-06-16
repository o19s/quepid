# frozen_string_literal: true

class DefaultScorerExistsValidator < ActiveModel::Validator
  def validate record
    return true if record.scorer_id.blank?

    scorer_type = record.scorer_type || 'Scorer'
    klass       = Object.const_get scorer_type

    record.errors.add(:scorer_id, :existence) unless klass.where(id: record.scorer_id).exists?
  end
end
