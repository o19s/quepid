# frozen_string_literal: true

# == Schema Information
#
# Table name: queries
#
#  id             :integer          not null, primary key
#  arranged_next  :integer
#  arranged_at    :integer
#  query_text     :string(191)
#  notes          :text(65535)
#  threshold      :float(24)
#  threshold_enbl :boolean
#  case_id        :integer
#  created_at     :datetime         not null
#  updated_at     :datetime         not null
#  options        :text(65535)
#  information_need :string
#

require 'arrangement/item'

class Query < ApplicationRecord
  # Arrangement
  include Arrangement::Item

  # Associations
  belongs_to  :case, autosave: true, optional: false

  has_many    :ratings,
              dependent: :destroy

  has_many    :snapshot_queries,
              dependent: :destroy

  # Validations
  validates :query_text,
            presence: true

  # Scopes

  def parent_list
    self.case.queries
  end

  def list_owner
    self.case
  end
end
