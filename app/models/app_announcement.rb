# frozen_string_literal: true

# == Schema Information
#
# Table name: app_announcements
#
#  id         :bigint           not null, primary key
#  text       :string(255)
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  author_id  :integer
#
class AppAnnouncement < ApplicationRecord
  belongs_to :author, class_name: 'User'
  has_many :app_announcement_viewed, dependent: :destroy
  has_many :viewers, through: :app_announcement_viewed, source: :user

  scope :latest_unseen_for_user, ->(user) {
    join_condition = "
      LEFT OUTER JOIN `app_announcement_vieweds`
        ON `app_announcements`.`id` = `app_announcement_vieweds`.`app_announcement_id`
        AND `app_announcement_vieweds`.`user_id` = ?
    "
    joins(sanitize_sql_array([ join_condition, user.id ]))
      .where('`app_announcement_vieweds`.`user_id` IS NULL')
      .order(created_at: :desc)
  }
end
