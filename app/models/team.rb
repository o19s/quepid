# frozen_string_literal: true

# <rails-lens:schema:begin>
# table = "teams"
# database_dialect = "MySQL"
# storage_engine = "InnoDB"
# character_set = "latin1"
# collation = "latin1_swedish_ci"
#
# columns = [
#   { name = "id", type = "integer", primary_key = true, nullable = false },
#   { name = "name", type = "string", nullable = true },
#   { name = "created_at", type = "datetime", nullable = false },
#   { name = "updated_at", type = "datetime", nullable = false }
# ]
#
# indexes = [
#   { name = "index_teams_on_name", columns = ["name"] }
# ]
#
# == Notes
# - Column 'name' should probably have NOT NULL constraint
# <rails-lens:schema:end>

class Team < ApplicationRecord
  # Associations
  # too late now!
  # rubocop:disable Rails/HasAndBelongsToMany
  has_and_belongs_to_many :cases,
                          join_table: 'teams_cases'

  has_and_belongs_to_many :members,
                          class_name:              'User',
                          join_table:              'teams_members',
                          association_foreign_key: 'member_id',
                          uniq:                    true

  has_and_belongs_to_many :scorers,
                          join_table: 'teams_scorers'

  has_and_belongs_to_many :search_endpoints,
                          join_table: 'teams_search_endpoints'

  has_and_belongs_to_many :books,
                          join_table: 'teams_books'

  # rubocop:enable Rails/HasAndBelongsToMany

  # Validations
  # rubocop:disable Rails/UniqueValidationWithoutIndex
  validates :name,
            presence:   true,
            uniqueness: true
  # rubocop:enable Rails/UniqueValidationWithoutIndex
end
