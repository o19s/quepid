# frozen_string_literal: true

# == Schema Information
#
# Table name: queries
#
#  id               :integer          not null, primary key
#  arranged_at      :bigint
#  arranged_next    :bigint
#  information_need :string(255)
#  notes            :text(65535)
#  options          :text(65535)
#  query_text       :string(500)
#  created_at       :datetime         not null
#  updated_at       :datetime         not null
#  case_id          :integer
#
# Indexes
#
#  case_id  (case_id)
#
# Foreign Keys
#
#  queries_ibfk_1  (case_id => cases.id)
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
  validates :query_text, presence: true, length: { maximum: 500 }

  # Scopes

  scope :has_information_need, -> { where.not(information_need: [ nil, '' ]) }

  serialize :options, coder: JSON

  def parent_list
    self.case.queries
  end

  def list_owner
    self.case
  end
end
