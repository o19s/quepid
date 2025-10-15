# frozen_string_literal: true

# == Schema Information
#
# Table name: announcements
#
#  id         :bigint           not null, primary key
#  live       :boolean          default(FALSE)
#  text       :text(65535)
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  author_id  :integer
#
# Indexes
#
#  index_announcements_author_id  (author_id)
#  index_announcements_on_live    (live)
#
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
