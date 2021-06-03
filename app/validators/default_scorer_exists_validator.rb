# frozen_string_literal: true

class DefaultScorerExistsValidator < ActiveModel::Validator
  def validate record
    return true if record.default_scorer_id.blank?

    record.errors.add(:default_scorer_id, :existence) unless Scorer.exists?(id: record.default_scorer_id)
  end
end
