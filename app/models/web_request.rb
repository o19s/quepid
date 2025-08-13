# frozen_string_literal: true

# <rails-lens:schema:begin>
# table = "web_requests"
# database_dialect = "MySQL"
# storage_engine = "InnoDB"
# character_set = "utf8mb4"
# collation = "utf8mb4_bin"
#
# columns = [
#   { name = "id", type = "integer", primary_key = true, nullable = false },
#   { name = "snapshot_query_id", type = "integer", nullable = true },
#   { name = "request", type = "binary", nullable = true },
#   { name = "response_status", type = "integer", nullable = true },
#   { name = "integer", type = "integer", nullable = true },
#   { name = "response", type = "binary", nullable = true },
#   { name = "created_at", type = "datetime", nullable = false },
#   { name = "updated_at", type = "datetime", nullable = false }
# ]
#
# indexes = [
#   { name = "index_web_requests_on_snapshot_query_id", columns = ["snapshot_query_id"], unique = true }
# ]
#
# foreign_keys = [
#   { column = "snapshot_query_id", references_table = "snapshot_queries", references_column = "id", name = "fk_rails_ee223371a5" }
# ]
#
# == Notes
# - Association 'snapshot_query' should specify inverse_of
# - Column 'request' should probably have NOT NULL constraint
# - Column 'response_status' should probably have NOT NULL constraint
# - Column 'integer' should probably have NOT NULL constraint
# - Column 'response' should probably have NOT NULL constraint
# - Status column 'response_status' should have a default value
# - Column 'response_status' is commonly used in queries - consider adding an index
# <rails-lens:schema:end>
# app/models/web_request.rb
class WebRequest < ApplicationRecord
  belongs_to :snapshot_query, optional: true
end
