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
require 'test_helper'

class AnnouncementTest < ActiveSupport::TestCase
  describe 'Creating a Announcement' do
    let(:user) { users(:random) }
    let(:existing_announcement) { announcements(:live_announcement) }
    test 'sets live flag to false by default' do
      announcement = Announcement.create(text: 'Hooray! 🥳 is ready to use.')

      assert_not announcement.live
    end

    test 'can be set to true, forcing others to false' do
      assert_predicate existing_announcement, :live?

      announcement = Announcement.create(text: 'Hooray! 🥳 is ready to use.')

      assert_not announcement.live
      existing_announcement.reload
      assert existing_announcement.live

      announcement.make_live!
      existing_announcement.reload
      assert_not existing_announcement.live
    end
  end
end
