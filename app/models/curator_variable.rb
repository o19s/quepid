# frozen_string_literal: true

# == Schema Information
#
# Table name: curator_variables
#
#  id             :integer          not null, primary key
#  name           :string(500)
#  value          :float(24)
#  query_param_id :integer
#  created_at     :datetime         not null
#  updated_at     :datetime         not null
#

class CuratorVariable < ActiveRecord::Base
  belongs_to :try,
             foreign_key: 'query_param_id',
             inverse_of:  :curator_variables

  validates :name,
            presence: true

  validates :value,
            presence: true

  def value
    self[:value].to_i == self[:value] ? self[:value].to_i : self[:value]
  end
end
