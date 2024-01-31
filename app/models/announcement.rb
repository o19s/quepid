# frozen_string_literal: true

# == Schema Information
#
# Table name: announcements
#
#  id         :bigint           not null, primary key
#  text       :string(255)
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  author_id  :integer
#
class Announcement < ApplicationRecord
  belongs_to :author, class_name: 'User'
  has_many :announcement_viewed, dependent: :destroy
  has_many :viewers, through: :announcement_viewed, source: :user

  scope :latest_unseen_for_user, ->(user) {
    join_condition = "
      LEFT OUTER JOIN `announcement_vieweds`
        ON `announcements`.`id` = `announcement_vieweds`.`announcement_id`
        AND `announcement_vieweds`.`user_id` = ?
    "
    joins(sanitize_sql_array([ join_condition, user.id ]))
      .where('`announcement_vieweds`.`user_id` IS NULL')
      .order(created_at: :desc)
  }
end
