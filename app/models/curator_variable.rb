# frozen_string_literal: true

# <rails-lens:schema:begin>
# table = "curator_variables"
# database_dialect = "MySQL"
# storage_engine = "InnoDB"
# character_set = "latin1"
# collation = "latin1_swedish_ci"
#
# columns = [
#   { name = "id", type = "integer", primary_key = true, nullable = false },
#   { name = "name", type = "string", nullable = true },
#   { name = "value", type = "float", nullable = true },
#   { name = "try_id", type = "integer", nullable = true },
#   { name = "created_at", type = "datetime", nullable = false },
#   { name = "updated_at", type = "datetime", nullable = false }
# ]
#
# indexes = [
#   { name = "try_id", columns = ["try_id"] }
# ]
#
# == Notes
# - Missing foreign key constraint on 'try_id' referencing 'tries'
# - Consider adding counter cache for 'try'
# - Column 'name' should probably have NOT NULL constraint
# - Column 'value' should probably have NOT NULL constraint
# <rails-lens:schema:end>

class CuratorVariable < ApplicationRecord
  belongs_to :try,
             inverse_of: :curator_variables

  validates :name,
            presence: true

  validates :value,
            presence: true

  def value
    self[:value].to_i == self[:value] ? self[:value].to_i : self[:value]
  end
end
