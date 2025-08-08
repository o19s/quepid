# frozen_string_literal: true

require 'test_helper'

class AnnouncementTest < ActiveSupport::TestCase
  describe 'Creating a Announcement' do
    let(:user) { users(:random) }
    let(:existing_announcement) { announcements(:live_announcement) }
    test 'sets live flag to false by default' do
      announcement = Announcement.create(text: 'Hooray! 🥳 is ready to use.')

      assert_equal announcement.live, false
    end

    test 'can be set to true, forcing others to false' do
      assert existing_announcement.live?

      announcement = Announcement.create(text: 'Hooray! 🥳 is ready to use.')

      assert_equal announcement.live, false
      existing_announcement.reload
      assert_equal existing_announcement.live, true

      announcement.make_live!
      existing_announcement.reload
      assert_equal existing_announcement.live, false
    end
  end
end
