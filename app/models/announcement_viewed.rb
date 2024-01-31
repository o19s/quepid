# frozen_string_literal: true

# == Schema Information
#
# Table name: announcement_vieweds
#
#  id              :bigint           not null, primary key
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#  announcement_id :integer
#  user_id         :integer
#
class AnnouncementViewed < ApplicationRecord
  belongs_to :user
  belongs_to :announcement
end
