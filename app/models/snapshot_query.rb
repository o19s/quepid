# frozen_string_literal: true

# <rails-lens:schema:begin>
# table = "snapshot_queries"
# database_dialect = "MySQL"
# storage_engine = "InnoDB"
# character_set = "latin1"
# collation = "latin1_swedish_ci"
#
# columns = [
#   { name = "id", type = "integer", primary_key = true, nullable = false },
#   { name = "query_id", type = "integer", nullable = true },
#   { name = "snapshot_id", type = "integer", nullable = true },
#   { name = "score", type = "float", nullable = true },
#   { name = "all_rated", type = "boolean", nullable = true },
#   { name = "number_of_results", type = "integer", nullable = true },
#   { name = "response_status", type = "integer", nullable = true }
# ]
#
# indexes = [
#   { name = "query_id", columns = ["query_id"] },
#   { name = "snapshot_id", columns = ["snapshot_id"] }
# ]
#
# foreign_keys = [
#   { column = "query_id", references_table = "queries", references_column = "id", name = "snapshot_queries_ibfk_1" },
#   { column = "snapshot_id", references_table = "snapshots", references_column = "id", name = "snapshot_queries_ibfk_2" }
# ]
#
# == Notes
# - Association 'snapshot' should specify inverse_of
# - Association 'query' should specify inverse_of
# - Association 'web_request' should specify inverse_of
# - Association 'snapshot_docs' has N+1 query risk. Consider using includes/preload
# - Column 'score' should probably have NOT NULL constraint
# - Column 'all_rated' should probably have NOT NULL constraint
# - Column 'number_of_results' should probably have NOT NULL constraint
# - Column 'response_status' should probably have NOT NULL constraint
# - Boolean column 'all_rated' should have a default value
# - Status column 'response_status' should have a default value
# - Column 'response_status' is commonly used in queries - consider adding an index
# - Missing timestamp columns (created_at, updated_at)
# <rails-lens:schema:end>
class SnapshotQuery < ApplicationRecord
  belongs_to  :snapshot, optional: true # shouldn't be
  belongs_to  :query, optional: true # shouldn't be
  has_one     :web_request, dependent: :destroy
  has_many    :snapshot_docs, -> { order(position: :asc) },
              dependent:  :delete_all,
              inverse_of: :snapshot_query
end
