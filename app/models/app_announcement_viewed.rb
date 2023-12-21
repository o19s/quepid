# frozen_string_literal: true

# == Schema Information
#
# Table name: app_announcement_vieweds
#
#  id                  :bigint           not null, primary key
#  created_at          :datetime         not null
#  updated_at          :datetime         not null
#  app_announcement_id :integer
#  user_id             :integer
#
class AppAnnouncementViewed < ApplicationRecord
  belongs_to :user
  belongs_to :app_announcement
end
