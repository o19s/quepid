# frozen_string_literal: true

# == Schema Information
#
# Table name: case_scores
#
#  id            :integer          not null, primary key
#  case_id       :integer
#  user_id       :integer
#  try_id        :integer
#  score         :float(24)
#  all_rated     :boolean
#  created_at    :datetime
#  queries       :binary(16777215)
#  annotation_id :integer
#  updated_at    :datetime
#

class Score < ApplicationRecord
  self.table_name = 'case_scores'

  serialize :queries, JSON

  # Associations
  belongs_to :case
  belongs_to :user
  belongs_to :try
  belongs_to :annotation, optional: true

  # Validations

  # Scores
  scope :last_one, -> {
    where(annotation_id: nil)
      .order(updated_at:  :desc)
      .order(created_at:  :desc)
      .order(id:          :desc)
      .limit(1)
      .first
  }
end
