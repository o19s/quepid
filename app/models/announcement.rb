# frozen_string_literal: true

# <rails-lens:schema:begin>
# table = "announcements"
# database_dialect = "MySQL"
# storage_engine = "InnoDB"
# character_set = "utf8mb4"
# collation = "utf8mb4_bin"
#
# columns = [
#   { name = "id", type = "integer", primary_key = true, nullable = false },
#   { name = "text", type = "text", nullable = true },
#   { name = "author_id", type = "integer", nullable = true },
#   { name = "created_at", type = "datetime", nullable = false },
#   { name = "updated_at", type = "datetime", nullable = false },
#   { name = "live", type = "boolean", nullable = true, default = "0" }
# ]
#
# indexes = [
#   { name = "index_announcements_author_id", columns = ["author_id"] },
#   { name = "index_announcements_on_live", columns = ["live"] }
# ]
#
# == Notes
# - Missing foreign key constraint on 'author_id' referencing 'users'
# - Association 'author' should specify inverse_of
# - Association 'announcement_viewed' should specify inverse_of
# - Association 'announcement_viewed' has N+1 query risk. Consider using includes/preload
# - Association 'viewers' has N+1 query risk. Consider using includes/preload
# - Column 'text' should probably have NOT NULL constraint
# - Column 'live' should probably have NOT NULL constraint
# <rails-lens:schema:end>
class Announcement < ApplicationRecord
  belongs_to :author, class_name: 'User'
  has_many :announcement_viewed, dependent: :destroy
  has_many :viewers, through: :announcement_viewed, source: :user

  validates :live, uniqueness: { if: :live? }
  validates :text, presence: true, length: { maximum: 1024 }

  scope :latest_unseen_for_user, ->(user) {
    join_condition = "
      LEFT OUTER JOIN `announcement_viewed`
        ON `announcements`.`id` = `announcement_viewed`.`announcement_id`
        AND `announcement_viewed`.`user_id` = ?
    "
    joins(sanitize_sql_array([ join_condition, user.id ]))
      .where('`announcement_viewed`.`user_id` IS NULL')
  }

  def live?
    live
  end

  def make_live!
    Announcement.update_all(live: false) # Set all announcements to not live
    update(live: true) # Set the current announcement as live
  end
  # rubocop:enable Rails/SkipsModelValidations
end
