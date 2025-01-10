# frozen_string_literal: true

# == Schema Information
#
# Table name: announcement_viewed
#
#  id              :bigint           not null, primary key
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#  announcement_id :integer
#  user_id         :integer
#
# Indexes
#
#  index_announcement_viewed_announcement_id  (announcement_id)
#
class AnnouncementViewed < ApplicationRecord
  self.table_name = 'announcement_viewed'
  belongs_to :user
  belongs_to :announcement
end
