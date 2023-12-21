# frozen_string_literal: true

class AppAnnouncementsViewedController < ApplicationController
  def create
    @app_announcement = AppAnnouncement.find(params[:app_announcement_id])
    @app_announcement_viewed = AppAnnouncementViewed.create(user: current_user, app_announcement: @app_announcement)

    redirect_to root_path
  end
end
