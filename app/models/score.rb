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
#  index_case_scores_annotation_id       (annotation_id) UNIQUE
#  index_case_scores_on_case_and_latest  (case_id,updated_at,created_at,id)
#  index_case_scores_on_case_id          (case_id)
#  index_case_scores_on_scorer_id        (scorer_id)
#  index_case_scores_on_user_id          (user_id)
#
# Foreign Keys
#
#  case_scores_ibfk_1  (case_id => cases.id)
#  case_scores_ibfk_2  (user_id => users.id)
#  fk_rails_...        (annotation_id => annotations.id)
#

class Score < ApplicationRecord
  self.table_name = 'case_scores'

  # Associations
  belongs_to :case, touch: true
  belongs_to :user, optional: true
  belongs_to :try, optional: true # Historical scores survive deletion of their try.
  belongs_to :annotation, optional: true
  belongs_to :scorer, optional: true # optional for legacy reasons, we have old data.

  # Validations

  serialize :queries, coder: JSON

  # Scopes

  # Hydrate only the displayed summary, leaving query payloads in the database.
  def self.latest_summaries_for_cases case_ids
    latest_ids = Case.where(id: case_ids).select(<<~SQL.squish)
      (SELECT case_scores.id FROM case_scores
       WHERE case_scores.case_id = cases.id
       ORDER BY case_scores.updated_at DESC, case_scores.created_at DESC, case_scores.id DESC
       LIMIT 1)
    SQL

    where(id: latest_ids).select(:id, :case_id, :score, :updated_at, :user_id).includes(:user)
  end

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
    # Current callers pass integer IDs and counts; decimal strings remain supported.
    raise ArgumentError, 'case_id and count must be nonnegative integers' unless case_id.to_s.match?(/\A[0-9]+\z/) && count.to_s.match?(/\A[0-9]+\z/)

    case_id = Integer(case_id.to_s, 10)
    count = Integer(count.to_s, 10)
    random_function = AdapterFunctions.random_function
    joins("
      JOIN (
        SELECT id FROM case_scores where case_id=#{case_id} ORDER BY #{random_function} LIMIT #{count}
      ) as filtered_case_scores ON case_scores.id=filtered_case_scores.id
    ")
  }
end
