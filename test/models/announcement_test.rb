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
require 'test_helper'

class AnnouncementTest < ActiveSupport::TestCase
  describe 'validations' do
    let(:user) { users(:random) }

    test 'requires publish_date' do
      announcement = Announcement.new(text: 'x', author: user, expiration_date: Date.current)

      assert_not announcement.valid?
      assert_includes announcement.errors[:publish_date], "can't be blank"
    end

    test 'requires expiration_date' do
      announcement = Announcement.new(text: 'x', author: user, publish_date: Date.current)

      assert_not announcement.valid?
      assert_includes announcement.errors[:expiration_date], "can't be blank"
    end

    test 'publish_date must be on or before expiration_date' do
      announcement = Announcement.new(text: 'x', author: user, publish_date: Date.current,
                                      expiration_date: 1.day.ago.to_date)

      assert_not announcement.valid?
      assert_includes announcement.errors[:publish_date], 'must be on or before the expiration date'
    end

    test 'publish_date equal to expiration_date is valid' do
      announcement = Announcement.new(text: 'x', author: user, publish_date: Date.current,
                                      expiration_date: Date.current)

      assert_predicate announcement, :valid?
    end
  end

  describe 'published?, expired?, and active?' do
    test 'a currently active announcement is published, not expired, and active' do
      announcement = announcements(:active_announcement)

      assert_predicate announcement, :published?
      assert_not announcement.expired?
      assert_predicate announcement, :active?
    end

    test 'an expired announcement is published but not active' do
      announcement = announcements(:expired_announcement)

      assert_predicate announcement, :published?
      assert_predicate announcement, :expired?
      assert_not announcement.active?
    end

    test 'an announcement scheduled for the future is not published and not active' do
      announcement = announcements(:scheduled_announcement)

      assert_not announcement.published?
      assert_not announcement.expired?
      assert_not announcement.active?
    end
  end

  describe '.active scope' do
    test 'only includes announcements currently between publish_date and expiration_date' do
      assert_includes Announcement.active, announcements(:active_announcement)
      assert_not_includes Announcement.active, announcements(:expired_announcement)
      assert_not_includes Announcement.active, announcements(:scheduled_announcement)
    end
  end
end
