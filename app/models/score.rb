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
#  scorer_id     :bigint
#  try_id        :integer
#  user_id       :integer
#
# Indexes
#
#  case_id                          (case_id)
#  index_case_scores_annotation_id  (annotation_id) UNIQUE
#  index_case_scores_on_scorer_id   (scorer_id)
#  support_last_score               (updated_at,created_at,id)
#  user_id                          (user_id)
#
# Foreign Keys
#
#  case_scores_ibfk_1  (case_id => cases.id)
#  case_scores_ibfk_2  (user_id => users.id)
#  fk_rails_...        (annotation_id => annotations.id)
#

class Score < ApplicationRecord
  self.table_name = 'case_scores'

  serialize :queries, coder: JSON

  # Associations
  belongs_to :case, touch: true
  belongs_to :user, optional: true
  belongs_to :try
  belongs_to :annotation, optional: true
  belongs_to :scorer, optional: true # optional for legacy reasons, we have old data.

  # Validations

  # Scopes

  # We have an index on updated_at, created_at, id to support this lookup.
  # Case 4848 is an example of a case that struggles with this.
  # The where(annotation_id: nil) part of the clause kills our performance.
  scope :last_one, -> {
    # where(annotation_id: nil)
    order(updated_at: :desc)
      .order(created_at:  :desc)
      .order(id:          :desc)
      .limit(1)
      .first
  }

  scope :scored, -> { where('score > ?', 0) }

  # Due to a bug, we have cases with 60,000+ scores, which kills our performance.
  # This is a terrible workaround till we get that problem fixed.
  # Have to pass in the case_id and the number of records to randomly sample.
  # Yes, needing to pass in the case_id is awkward if you have kase.scorers.sampled(kase.id, 100).count
  scope :sampled, ->(case_id, count) {
    joins("
      JOIN (
        SELECT id FROM case_scores where case_id=#{case_id} ORDER BY RAND() LIMIT #{count}
      ) as filtered_case_scores ON `case_scores`.`id`=filtered_case_scores.id
    ")
  }
end
