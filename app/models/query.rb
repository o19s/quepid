# frozen_string_literal: true

# == Schema Information
#
# Table name: queries
#
#  id             :integer          not null, primary key
#  arranged_next  :integer
#  arranged_at    :integer
#  deleted        :boolean
#  query_text     :string(191)
#  notes          :text(65535)
#  threshold      :float(24)
#  threshold_enbl :boolean
#  case_id        :integer
#  created_at     :datetime         not null
#  updated_at     :datetime         not null
#  options        :text(65535)
#

require 'arrangement/item'

class Query < ApplicationRecord
  # Arrangement
  include Arrangement::Item

  # Associations
  belongs_to  :case, autosave: true, optional: false

  has_many    :ratings,
              dependent: :destroy

  # Validations
  validates :query_text,
            presence: true

  # Scopes
  # Lot of folks say don't use default_scopes since if you do case.queries you down't see deleted queries!
  default_scope -> { where(deleted: false).or(where(deleted: nil)) }

  # TODO: use the acts_as_paranoid gem instead
  # Which requires change to the db, that is not going to be done in the
  # initial scope of work in the rails migration
  def soft_delete
    update deleted: true
  end

  def parent_list
    self.case.queries
  end

  def list_owner
    self.case
  end
end
