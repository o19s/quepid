# frozen_string_literal: true

class ScorerExistsValidator < ActiveModel::Validator
  def validate record
    return true if record.scorer_id.blank?

    record.errors.add(:scorer_id, :existence) unless Scorer.where(id: record.scorer_id).exists?
  end
end
