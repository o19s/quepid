# frozen_string_literal: true

# <rails-lens:schema:begin>
# table = "queries"
# database_dialect = "MySQL"
# storage_engine = "InnoDB"
# character_set = "utf8mb3"
# collation = "utf8mb3_general_ci"
#
# columns = [
#   { name = "id", type = "integer", primary_key = true, nullable = false },
#   { name = "arranged_next", type = "integer", nullable = true },
#   { name = "arranged_at", type = "integer", nullable = true },
#   { name = "query_text", type = "string", nullable = true },
#   { name = "notes", type = "text", nullable = true },
#   { name = "case_id", type = "integer", nullable = true },
#   { name = "created_at", type = "datetime", nullable = false },
#   { name = "updated_at", type = "datetime", nullable = false },
#   { name = "information_need", type = "string", nullable = true },
#   { name = "options", type = "json", nullable = true }
# ]
#
# indexes = [
#   { name = "case_id", columns = ["case_id"] }
# ]
#
# foreign_keys = [
#   { column = "case_id", references_table = "cases", references_column = "id", name = "queries_ibfk_1" }
# ]
#
# == Notes
# - Association 'case' should specify inverse_of
# - Association 'ratings' should specify inverse_of
# - Association 'snapshot_queries' should specify inverse_of
# - Association 'ratings' has N+1 query risk. Consider using includes/preload
# - Association 'snapshot_queries' has N+1 query risk. Consider using includes/preload
# - Column 'arranged_next' should probably have NOT NULL constraint
# - Column 'query_text' should probably have NOT NULL constraint
# - Column 'notes' should probably have NOT NULL constraint
# - Column 'information_need' should probably have NOT NULL constraint
# - Column 'options' should probably have NOT NULL constraint
# <rails-lens:schema:end>

require_relative 'concerns/arrangement/item'

class Query < ApplicationRecord
  # Arrangement
  include Arrangement::Item

  # Associations
  belongs_to  :case, autosave: true, optional: false, touch: true

  has_many    :ratings,
              dependent: :destroy

  has_many    :snapshot_queries,
              dependent: :destroy

  # Validations
  validates :query_text, presence: true, length: { maximum: 2048 }

  # Scopes

  scope :has_information_need, -> { where.not(information_need: [ nil, '' ]) }

  def parent_list
    self.case.queries
  end

  def list_owner
    self.case
  end
end
