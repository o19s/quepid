# frozen_string_literal: true

# <rails-lens:schema:begin>
# table = "snapshot_docs"
# database_dialect = "MySQL"
# storage_engine = "InnoDB"
# character_set = "latin1"
# collation = "latin1_swedish_ci"
#
# columns = [
#   { name = "id", type = "integer", primary_key = true, nullable = false },
#   { name = "doc_id", type = "string", nullable = true },
#   { name = "position", type = "integer", nullable = true },
#   { name = "snapshot_query_id", type = "integer", nullable = true },
#   { name = "explain", type = "text", nullable = true },
#   { name = "rated_only", type = "boolean", nullable = true, default = "0" },
#   { name = "fields", type = "text", nullable = true }
# ]
#
# indexes = [
#   { name = "snapshot_query_id", columns = ["snapshot_query_id"] }
# ]
#
# foreign_keys = [
#   { column = "snapshot_query_id", references_table = "snapshot_queries", references_column = "id", name = "snapshot_docs_ibfk_1" }
# ]
#
# == Notes
# - Association 'snapshot_query' should specify inverse_of
# - Column 'position' should probably have NOT NULL constraint
# - Column 'explain' should probably have NOT NULL constraint
# - Column 'rated_only' should probably have NOT NULL constraint
# - Column 'fields' should probably have NOT NULL constraint
# - Missing timestamp columns (created_at, updated_at)
# <rails-lens:schema:end>

class SnapshotDoc < ApplicationRecord
  belongs_to :snapshot_query, optional: true # shouldn't be

  acts_as_list column: :position, add_new_at: :bottom, scope: :snapshot_query
end
