# frozen_string_literal: true

# <rails-lens:schema:begin>
# table = "annotations"
# database_dialect = "MySQL"
# storage_engine = "InnoDB"
# character_set = "utf8mb3"
# collation = "utf8mb3_general_ci"
#
# columns = [
#   { name = "id", type = "integer", primary_key = true, nullable = false },
#   { name = "message", type = "text", nullable = true },
#   { name = "source", type = "string", nullable = true },
#   { name = "user_id", type = "integer", nullable = true },
#   { name = "created_at", type = "datetime", nullable = false },
#   { name = "updated_at", type = "datetime", nullable = false }
# ]
#
# indexes = [
#   { name = "index_annotations_on_user_id", columns = ["user_id"] }
# ]
#
# foreign_keys = [
#   { column = "user_id", references_table = "users", references_column = "id", name = "fk_rails_4043df79bf" }
# ]
#
# == Notes
# - Association 'score' should specify inverse_of
# - Column 'message' should probably have NOT NULL constraint
# - Column 'source' should probably have NOT NULL constraint
# <rails-lens:schema:end>

class Annotation < ApplicationRecord
  # Associations
  belongs_to  :user, optional: false
  has_one     :score, dependent: :destroy
  has_one     :case, through: :score

  default_scope -> { order(updated_at: :desc) }
end
