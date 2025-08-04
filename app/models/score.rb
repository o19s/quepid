# frozen_string_literal: true

# <rails-lens:schema:begin>
# table = "case_scores"
# database_dialect = "MySQL"
# storage_engine = "InnoDB"
# character_set = "latin1"
# collation = "latin1_swedish_ci"
#
# columns = [
#   { name = "id", type = "integer", primary_key = true, nullable = false },
#   { name = "case_id", type = "integer", nullable = true },
#   { name = "user_id", type = "integer", nullable = true },
#   { name = "try_id", type = "integer", nullable = true },
#   { name = "score", type = "float", nullable = true },
#   { name = "all_rated", type = "boolean", nullable = true },
#   { name = "created_at", type = "datetime", nullable = true },
#   { name = "queries", type = "binary", nullable = true },
#   { name = "annotation_id", type = "integer", nullable = true },
#   { name = "updated_at", type = "datetime", nullable = true },
#   { name = "scorer_id", type = "integer", nullable = true }
# ]
#
# indexes = [
#   { name = "index_case_scores_annotation_id", columns = ["annotation_id"], unique = true },
#   { name = "case_id", columns = ["case_id"] },
#   { name = "index_case_scores_on_scorer_id", columns = ["scorer_id"] },
#   { name = "support_last_score", columns = ["updated_at", "created_at", "id"] },
#   { name = "user_id", columns = ["user_id"] }
# ]
#
# foreign_keys = [
#   { column = "case_id", references_table = "cases", references_column = "id", name = "case_scores_ibfk_1" },
#   { column = "user_id", references_table = "users", references_column = "id", name = "case_scores_ibfk_2" },
#   { column = "annotation_id", references_table = "annotations", references_column = "id", name = "fk_rails_293fbffb66" }
# ]
#
# == Notes
# - Missing index on foreign key 'try_id'
# - Missing foreign key constraint on 'try_id' referencing 'tries'
# - Missing foreign key constraint on 'scorer_id' referencing 'scorers'
# - Association 'case' should specify inverse_of
# - Association 'user' should specify inverse_of
# - Association 'annotation' should specify inverse_of
# - Association 'scorer' should specify inverse_of
# - Column 'score' should probably have NOT NULL constraint
# - Column 'all_rated' should probably have NOT NULL constraint
# - Column 'queries' should probably have NOT NULL constraint
# - Boolean column 'all_rated' should have a default value
# <rails-lens:schema:end>

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
