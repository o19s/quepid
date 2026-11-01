# frozen_string_literal: true

# What one user has made in Quepid from one of the example datasets (DatasetCatalog::ENTRIES,
# named by key): the scorer built for its labels, the search endpoint it is hosted in, and the
# cases loaded from it. The cases link through case_to_datasets, so the Case model is untouched.
class Dataset < ApplicationRecord
  belongs_to :owner, class_name: 'User'
  belongs_to :scorer, optional: true
  belongs_to :search_endpoint, optional: true

  has_many :case_to_datasets, dependent: :delete_all
  # A case deleted elsewhere drops out of this list, since the join is an inner one.
  has_many :cases, through: :case_to_datasets

  validates :key, presence: true, uniqueness: { scope: :owner_id }

  def self.for owner, key
    find_or_create_by!(owner: owner, key: key)
  end
end
