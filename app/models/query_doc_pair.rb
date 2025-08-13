# frozen_string_literal: true

# <rails-lens:schema:begin>
# table = "query_doc_pairs"
# database_dialect = "MySQL"
# storage_engine = "InnoDB"
# character_set = "utf8mb3"
# collation = "utf8mb3_unicode_ci"
#
# columns = [
#   { name = "id", type = "integer", primary_key = true, nullable = false },
#   { name = "query_text", type = "string", nullable = true },
#   { name = "position", type = "integer", nullable = true },
#   { name = "document_fields", type = "text", nullable = true },
#   { name = "book_id", type = "integer", nullable = false },
#   { name = "created_at", type = "datetime", nullable = false },
#   { name = "updated_at", type = "datetime", nullable = false },
#   { name = "doc_id", type = "string", nullable = true },
#   { name = "information_need", type = "string", nullable = true },
#   { name = "notes", type = "text", nullable = true },
#   { name = "options", type = "json", nullable = true }
# ]
#
# indexes = [
#   { name = "index_query_doc_pairs_on_book_id", columns = ["book_id"] }
# ]
#
# foreign_keys = [
#   { column = "book_id", references_table = "books", references_column = "id", name = "fk_rails_4968764fab" }
# ]
#
# == Notes
# - Association 'book' should specify inverse_of
# - Association 'judgements' should specify inverse_of
# - Association 'judgements' has N+1 query risk. Consider using includes/preload
# - Column 'query_text' should probably have NOT NULL constraint
# - Column 'position' should probably have NOT NULL constraint
# - Column 'document_fields' should probably have NOT NULL constraint
# - Column 'information_need' should probably have NOT NULL constraint
# - Column 'notes' should probably have NOT NULL constraint
# - Column 'options' should probably have NOT NULL constraint
# <rails-lens:schema:end>
class QueryDocPair < ApplicationRecord
  belongs_to :book
  has_many :judgements, dependent: :destroy, autosave: true

  validates :query_text, presence: true, length: { maximum: 2048 }
  validates :doc_id, presence: true
  validates :position, numericality: { only_integer: true }, allow_nil: true
  validates :document_fields, presence: true, json: true, allow_nil: true
  validates :options, json: true

  scope :has_judgements, -> { joins(:judgements) }
end
