# frozen_string_literal: true

# <rails-lens:schema:begin>
# table = "ahoy_events"
# database_dialect = "MySQL"
# storage_engine = "InnoDB"
# character_set = "utf8mb4"
# collation = "utf8mb4_bin"
#
# columns = [
#   { name = "id", type = "integer", primary_key = true, nullable = false },
#   { name = "visit_id", type = "integer", nullable = true },
#   { name = "user_id", type = "integer", nullable = true },
#   { name = "name", type = "string", nullable = true },
#   { name = "properties", type = "json", nullable = true },
#   { name = "time", type = "datetime", nullable = true }
# ]
#
# indexes = [
#   { name = "index_ahoy_events_on_name_and_time", columns = ["name", "time"] },
#   { name = "index_ahoy_events_on_user_id", columns = ["user_id"] },
#   { name = "index_ahoy_events_on_visit_id", columns = ["visit_id"] }
# ]
#
# == Notes
# - Missing foreign key constraint on 'visit_id' referencing 'ahoy_visits'
# - Missing foreign key constraint on 'user_id' referencing 'users'
# - Association 'visit' should specify inverse_of
# - Column 'name' should probably have NOT NULL constraint
# - Column 'properties' should probably have NOT NULL constraint
# - Column 'time' should probably have NOT NULL constraint
# - Missing timestamp columns (created_at, updated_at)
# <rails-lens:schema:end>
module Ahoy
  class Event < ApplicationRecord
    include Ahoy::QueryMethods

    self.table_name = 'ahoy_events'

    belongs_to :visit
    belongs_to :user, optional: true
  end
end
