# frozen_string_literal: true

# <rails-lens:schema:begin>
# table = "ahoy_visits"
# database_dialect = "MySQL"
# storage_engine = "InnoDB"
# character_set = "utf8mb4"
# collation = "utf8mb4_bin"
#
# columns = [
#   { name = "id", type = "integer", primary_key = true, nullable = false },
#   { name = "visit_token", type = "string", nullable = true },
#   { name = "visitor_token", type = "string", nullable = true },
#   { name = "user_id", type = "integer", nullable = true },
#   { name = "ip", type = "string", nullable = true },
#   { name = "user_agent", type = "text", nullable = true },
#   { name = "referrer", type = "text", nullable = true },
#   { name = "referring_domain", type = "string", nullable = true },
#   { name = "landing_page", type = "text", nullable = true },
#   { name = "browser", type = "string", nullable = true },
#   { name = "os", type = "string", nullable = true },
#   { name = "device_type", type = "string", nullable = true },
#   { name = "country", type = "string", nullable = true },
#   { name = "region", type = "string", nullable = true },
#   { name = "city", type = "string", nullable = true },
#   { name = "latitude", type = "float", nullable = true },
#   { name = "longitude", type = "float", nullable = true },
#   { name = "utm_source", type = "string", nullable = true },
#   { name = "utm_medium", type = "string", nullable = true },
#   { name = "utm_term", type = "string", nullable = true },
#   { name = "utm_content", type = "string", nullable = true },
#   { name = "utm_campaign", type = "string", nullable = true },
#   { name = "app_version", type = "string", nullable = true },
#   { name = "os_version", type = "string", nullable = true },
#   { name = "platform", type = "string", nullable = true },
#   { name = "started_at", type = "datetime", nullable = true }
# ]
#
# indexes = [
#   { name = "index_ahoy_visits_on_visit_token", columns = ["visit_token"], unique = true },
#   { name = "index_ahoy_visits_on_user_id", columns = ["user_id"] },
#   { name = "index_ahoy_visits_on_visitor_token_and_started_at", columns = ["visitor_token", "started_at"] }
# ]
#
# == Notes
# - Missing foreign key constraint on 'user_id' referencing 'users'
# - Association 'events' has N+1 query risk. Consider using includes/preload
# - Column 'visit_token' should probably have NOT NULL constraint
# - Column 'visitor_token' should probably have NOT NULL constraint
# - Column 'ip' should probably have NOT NULL constraint
# - Column 'user_agent' should probably have NOT NULL constraint
# - Column 'referrer' should probably have NOT NULL constraint
# - Column 'referring_domain' should probably have NOT NULL constraint
# - Column 'landing_page' should probably have NOT NULL constraint
# - Column 'browser' should probably have NOT NULL constraint
# - Column 'os' should probably have NOT NULL constraint
# - Column 'device_type' should probably have NOT NULL constraint
# - Column 'country' should probably have NOT NULL constraint
# - Column 'region' should probably have NOT NULL constraint
# - Column 'city' should probably have NOT NULL constraint
# - Column 'latitude' should probably have NOT NULL constraint
# - Column 'longitude' should probably have NOT NULL constraint
# - Column 'utm_source' should probably have NOT NULL constraint
# - Column 'utm_medium' should probably have NOT NULL constraint
# - Column 'utm_term' should probably have NOT NULL constraint
# - Column 'utm_content' should probably have NOT NULL constraint
# - Column 'utm_campaign' should probably have NOT NULL constraint
# - Column 'app_version' should probably have NOT NULL constraint
# - Column 'os_version' should probably have NOT NULL constraint
# - Column 'platform' should probably have NOT NULL constraint
# - Column 'device_type' is commonly used in queries - consider adding an index
# - Missing timestamp columns (created_at, updated_at)
# <rails-lens:schema:end>
module Ahoy
  class Visit < ApplicationRecord
    self.table_name = 'ahoy_visits'

    has_many :events, class_name: 'Ahoy::Event', dependent: :destroy
    belongs_to :user, optional: true
  end
end
