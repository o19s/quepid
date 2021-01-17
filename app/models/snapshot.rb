# frozen_string_literal: true

# == Schema Information
#
# Table name: snapshots
#
#  id         :integer          not null, primary key
#  name       :string(250)
#  created_at :datetime
#  case_id    :integer
#  updated_at :datetime         not null
#

class Snapshot < ApplicationRecord
  # Associations
  belongs_to  :case, optional: true # shouldn't be optional!
  has_many    :snapshot_queries, dependent: :destroy

  # Validations
  validates :name,
            presence: true

  # Callbacks
  before_validation :set_defaults

  private

  def set_defaults
    self.name = "Snapshot #{Time.zone.now.strftime('%D')}" if name.blank?
  end
end
