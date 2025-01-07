# frozen_string_literal: true

# == Schema Information
#
# Table name: snapshots
#
#  id         :integer          not null, primary key
#  name       :string(250)
#  created_at :datetime
#  updated_at :datetime         not null
#  case_id    :integer
#  scorer_id  :bigint
#  try_id     :bigint
#
# Indexes
#
#  case_id                       (case_id)
#  index_snapshots_on_scorer_id  (scorer_id)
#  index_snapshots_on_try_id     (try_id)
#
# Foreign Keys
#
#  snapshots_ibfk_1  (case_id => cases.id)
#

class Snapshot < ApplicationRecord
  # Associations
  belongs_to  :case, optional: true # shouldn't be optional!
  belongs_to  :try, optional: true # shouldn't be optional!
  belongs_to  :scorer, optional: true # shouldn't be optional!

  # see the call back delete_associated_objects for special delete logic.
  has_many    :snapshot_queries, dependent: :destroy
  has_many :snapshot_docs,
           through: :snapshot_queries # , dependent: :destroy

  has_one_attached :snapshot_file

  # Validations
  validates :name, presence: true

  # Callbacks
  before_validation :set_defaults
  # before_destroy :delete_associated_objects

  private

  def set_defaults
    self.name = "Snapshot #{Time.zone.now.strftime('%D')}" if name.blank?
  end

  # def delete_associated_objects
  #   puts 'I am about to delete associated objects'
  #   SnapshotDoc.joins(snapshot_query: :snapshot)
  #     .where(snapshot_queries: { snapshot: self })
  #     .delete_all
  #   snapshot_queries.delete_all
  # end
end
