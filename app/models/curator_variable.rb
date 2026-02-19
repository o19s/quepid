# frozen_string_literal: true

# == Schema Information
#
# Table name: curator_variables
#
#  id         :integer          not null, primary key
#  name       :string(500)
#  value      :float(24)
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  try_id     :integer
#
# Indexes
#
#  try_id  (try_id)
#

class CuratorVariable < ApplicationRecord
  belongs_to :try,
             inverse_of: :curator_variables

  validates :name,
            presence: true
  validates :name,
            format: { with: /\A[A-Za-z0-9_]+\z/, message: 'may only contain letters, numbers, and underscores' }

  validates :value,
            presence: true

  def value
    self[:value].to_i == self[:value] ? self[:value].to_i : self[:value]
  end
end
