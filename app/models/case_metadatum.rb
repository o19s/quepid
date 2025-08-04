# frozen_string_literal: true

# <rails-lens:schema:begin>
# table = "case_metadata"
# database_dialect = "MySQL"
# storage_engine = "InnoDB"
# character_set = "latin1"
# collation = "latin1_swedish_ci"
#
# columns = [
#   { name = "id", type = "integer", primary_key = true, nullable = false },
#   { name = "user_id", type = "integer", nullable = false },
#   { name = "case_id", type = "integer", nullable = false },
#   { name = "last_viewed_at", type = "datetime", nullable = true }
# ]
#
# indexes = [
#   { name = "case_metadata_ibfk_1", columns = ["case_id"] },
#   { name = "idx_last_viewed_case", columns = ["last_viewed_at", "case_id"] },
#   { name = "case_metadata_user_id_case_id_index", columns = ["user_id", "case_id"] }
# ]
#
# foreign_keys = [
#   { column = "case_id", references_table = "cases", references_column = "id", name = "case_metadata_ibfk_1" },
#   { column = "user_id", references_table = "users", references_column = "id", name = "case_metadata_ibfk_2" }
# ]
#
# == Notes
# - Association 'case' should specify inverse_of
# - Association 'user' should specify inverse_of
# - Missing timestamp columns (created_at, updated_at)
# <rails-lens:schema:end>

class CaseMetadatum < ApplicationRecord
  belongs_to :case
  belongs_to :user
end
