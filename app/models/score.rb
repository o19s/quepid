# frozen_string_literal: true

# == Schema Information
#
# Table name: case_scores
#
#  id            :integer          not null, primary key
#  all_rated     :boolean
#  queries       :binary(16777215)
#  score         :float(24)
#  created_at    :datetime
#  updated_at    :datetime
#  annotation_id :integer
#  case_id       :integer
#  try_id        :integer
#  user_id       :integer
#
# Indexes
#
#  case_id                             (case_id)
#  index_case_scores_on_annotation_id  (annotation_id)
#  user_id                             (user_id)
#
# Foreign Keys
#
#  case_scores_ibfk_1  (case_id => cases.id)
#  case_scores_ibfk_2  (user_id => users.id)
#  fk_rails_...        (annotation_id => annotations.id)
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
      .order(updated_at: :desc)
      .order(created_at:  :desc)
      .order(id:          :desc)
      .limit(1)
      .first
  }

  scope :scored, -> { where('score > ?', 0) }
end
