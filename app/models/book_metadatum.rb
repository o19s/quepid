# frozen_string_literal: true

# <rails-lens:schema:begin>
# table = "book_metadata"
# database_dialect = "MySQL"
# storage_engine = "InnoDB"
# character_set = "utf8mb4"
# collation = "utf8mb4_bin"
#
# columns = [
#   { name = "id", type = "integer", primary_key = true, nullable = false },
#   { name = "user_id", type = "integer", nullable = true },
#   { name = "book_id", type = "integer", nullable = false },
#   { name = "last_viewed_at", type = "datetime", nullable = true }
# ]
#
# indexes = [
#   { name = "index_book_metadata_on_book_id", columns = ["book_id"] },
#   { name = "index_book_metadata_on_user_id_and_book_id", columns = ["user_id", "book_id"] }
# ]
#
# foreign_keys = [
#   { column = "book_id", references_table = "books", references_column = "id", name = "fk_rails_98c6a4bdd3" }
# ]
#
# == Notes
# - Missing foreign key constraint on 'user_id' referencing 'users'
# - Association 'book' should specify inverse_of
# - Association 'user' should specify inverse_of
# - Missing timestamp columns (created_at, updated_at)
# <rails-lens:schema:end>
class BookMetadatum < ApplicationRecord
  belongs_to :book
  belongs_to :user
end
