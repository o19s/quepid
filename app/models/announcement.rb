# frozen_string_literal: true

# == Schema Information
#
# Table name: announcements
#
#  id              :bigint           not null, primary key
#  expiration_date :date             not null
#  publish_date    :date             not null
#  text            :text(65535)
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#  author_id       :integer
#
# Indexes
#
#  index_announcements_author_id  (author_id)
#
class Announcement < ApplicationRecord
  belongs_to :author, class_name: 'User'
  has_many :announcement_viewed, dependent: :destroy
  has_many :viewers, through: :announcement_viewed, source: :user

  validates :text, presence: true, length: { maximum: 1024 }
  validates :publish_date, presence: true
  validates :expiration_date, presence: true
  validate :publish_date_not_after_expiration_date

  # Ordered by publish_date desc, id desc so the most recently scheduled announcement
  # wins when windows overlap (id as a tiebreaker keeps same-day picks deterministic) -
  # avoids needing a separate "only one active" flag to keep in sync.
  scope :active, -> {
    where(publish_date: ..Date.current).where(expiration_date: Date.current..).order(publish_date: :desc, id: :desc)
  }

  scope :latest_unseen_for_user, ->(user) {
    join_condition = "
      LEFT OUTER JOIN announcement_viewed
        ON announcements.id = announcement_viewed.announcement_id
        AND announcement_viewed.user_id = ?
    "
    joins(sanitize_sql_array([ join_condition, user.id ]))
      .where(announcement_viewed: { user_id: nil })
  }

  def published?
    publish_date <= Date.current
  end

  def expired?
    expiration_date < Date.current
  end

  def active?
    published? && !expired?
  end

  private

  def publish_date_not_after_expiration_date
    return if publish_date.blank? || expiration_date.blank?
    return if publish_date <= expiration_date

    errors.add(:publish_date, 'must be on or before the expiration date')
  end
end
