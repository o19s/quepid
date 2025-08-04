# frozen_string_literal: true

# <rails-lens:schema:begin>
# table = "ratings"
# database_dialect = "MySQL"
# storage_engine = "InnoDB"
# character_set = "latin1"
# collation = "latin1_swedish_ci"
#
# columns = [
#   { name = "id", type = "integer", primary_key = true, nullable = false },
#   { name = "doc_id", type = "string", nullable = true },
#   { name = "rating", type = "float", nullable = true },
#   { name = "query_id", type = "integer", nullable = true },
#   { name = "created_at", type = "datetime", nullable = false },
#   { name = "updated_at", type = "datetime", nullable = false },
#   { name = "user_id", type = "integer", nullable = true }
# ]
#
# indexes = [
#   { name = "index_ratings_on_doc_id", columns = ["doc_id"] },
#   { name = "query_id", columns = ["query_id"] }
# ]
#
# foreign_keys = [
#   { column = "query_id", references_table = "queries", references_column = "id", name = "ratings_ibfk_1" }
# ]
#
# == Notes
# - Missing index on foreign key 'user_id'
# - Missing foreign key constraint on 'user_id' referencing 'users'
# - Association 'query' should specify inverse_of
# - Column 'rating' should probably have NOT NULL constraint
# <rails-lens:schema:end>

class Rating < ApplicationRecord
  belongs_to :query
  belongs_to :user, optional: true

  # arguably we shouldn't need this, however today you can have a rating object that doesn't have a
  # value set.  fully_rated means that the rating integer has been set.
  scope :fully_rated, -> { where.not(rating: nil) }
end
