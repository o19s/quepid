# frozen_string_literal: true

# Links a case to the Dataset it was loaded from. The case is created at once and its queries are
# loaded by LoadDatasetCaseJob; status says where that is, and error why it failed.
class CaseToDataset < ApplicationRecord
  STATUSES = %w[pending loading done failed].freeze

  belongs_to :dataset
  belongs_to :case

  validates :case_id, uniqueness: true
  validates :status, inclusion: { in: STATUSES }

  def in_progress?
    %w[pending loading].include?(status)
  end

  def failed?
    'failed' == status
  end
end
