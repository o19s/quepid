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
#  scorer_id      :integer
#  scorer_enbl    :boolean
#  created_at     :datetime         not null
#  updated_at     :datetime         not null
#  scorer_type    :string(255)
#  options        :text(65535)
#

require 'arrangement/item'

class Query < ActiveRecord::Base
  # Arrangement
  include Arrangement::Item

  # Associations
  belongs_to  :scorer, polymorphic: true
  belongs_to  :case, autosave: true

  has_many    :ratings,
              dependent:  :destroy

  has_one     :test,
              class_name: 'Scorer',
              dependent:  :destroy

  # Validations
  validates :query_text,
            presence: true

  # Scopes
  default_scope -> { where.any_of({ deleted: false }, deleted: nil) }

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
