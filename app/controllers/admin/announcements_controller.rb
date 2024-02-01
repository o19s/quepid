# frozen_string_literal: true

module Admin
  class AnnouncementsController < Admin::AdminController
    skip_before_action :check_for_announcement
    def index
      @announcements = Announcement.all
    end

    def new
      @announcement = Announcement.new
      @announcement.text = ''
    end

    def edit
      @announcement = Announcement.find(params[:id])
    end

    def create
      @announcement = Announcement.new(announcement_params)
      @announcement.author = current_user

      if @announcement.save
        redirect_to admin_announcements_path
      else
        render 'new'
      end
    end

    def update
      @announcement = Announcement.find(params[:id])
      if @announcement.update(announcement_params)
        redirect_to admin_announcements_path
      else
        render 'edit'
      end
    end

    def destroy
      @announcement = Announcement.find(params[:id])
      @announcement.destroy
      redirect_to admin_announcements_path
    end

    def publish
      @announcement = Announcement.find(params[:id])
      if @announcement.live?
        @announcement.update(live: false)
        redirect_to admin_announcements_path, notice: "Announcement id #{@announcement.id} is hidden."
      else
        @announcement.make_live!
        redirect_to admin_announcements_path, notice: "Announcement id #{@announcement.id} is now live."
      end
    end

    private

    def announcement_params
      params.require(:announcement).permit(:text, :author_id)
    end
  end
end
