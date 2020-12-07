# frozen_string_literal: true

# == Schema Information
#
# Table name: curator_variables
#
#  id             :integer          not null, primary key
#  name           :string(500)
#  value          :float(24)
#  try_id         :integer
#  created_at     :datetime         not null
#  updated_at     :datetime         not null
#

class CuratorVariable < ApplicationRecord
  belongs_to :try,
             inverse_of: :curator_variables

  validates :name,
            presence: true

  validates :value,
            presence: true

  def value
    self[:value].to_i == self[:value] ? self[:value].to_i : self[:value]
  end
end
