# frozen_string_literal: true

# Links a case to the Dataset it was loaded from. The case is created at once and its queries are
# loaded by LoadDatasetCaseJob; status says where that is, and error why it failed.
class CaseToDataset < ApplicationRecord
  STATUSES = %w[pending loading done failed].freeze

  belongs_to :dataset
  belongs_to :case

  validates :case_id, uniqueness: true
  validates :status, inclusion: { in: STATUSES }

  # Deletes the owner's links whose case has been deleted. Cases are deleted without telling us (the Case model
  # knows nothing about datasets), and the lists already skip such links, so this only tidies the table.
  def self.drop_orphans_of owner
    where(dataset_id: Dataset.where(owner: owner).select(:id)).where.not(case_id: Case.select(:id)).delete_all
  end

  def in_progress?
    %w[pending loading].include?(status)
  end

  # Its documents are being indexed into a search engine (not waiting for its queries to load: that is in_progress?).
  def indexing?
    %w[pending indexing].include?(indexing_status)
  end

  def indexing_failed?
    'failed' == indexing_status
  end

  def failed?
    'failed' == status
  end
end
