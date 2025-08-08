# frozen_string_literal: true

# <rails-lens:schema:begin>
# table = "announcement_viewed"
# database_dialect = "MySQL"
# storage_engine = "InnoDB"
# character_set = "utf8mb4"
# collation = "utf8mb4_bin"
#
# columns = [
#   { name = "id", type = "integer", primary_key = true, nullable = false },
#   { name = "announcement_id", type = "integer", nullable = true },
#   { name = "user_id", type = "integer", nullable = true },
#   { name = "created_at", type = "datetime", nullable = false },
#   { name = "updated_at", type = "datetime", nullable = false }
# ]
#
# indexes = [
#   { name = "index_announcement_viewed_announcement_id", columns = ["announcement_id"] }
# ]
#
# == Notes
# - Missing index on foreign key 'user_id'
# - Missing foreign key constraint on 'user_id' referencing 'users'
# - Missing foreign key constraint on 'announcement_id' referencing 'announcements'
# - Association 'announcement' should specify inverse_of
# - Consider adding counter cache for 'announcement'
# - Table name 'announcement_viewed' doesn't follow Rails conventions (should be plural, snake_case)
# <rails-lens:schema:end>
class AnnouncementViewed < ApplicationRecord
  self.table_name = 'announcement_viewed'
  belongs_to :user
  belongs_to :announcement
end
