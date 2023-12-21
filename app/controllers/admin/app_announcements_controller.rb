# frozen_string_literal: true

module Admin
  class AppAnnouncementsController < Admin::AdminController
    def index
      @app_announcements = AppAnnouncement.all
    end

    def show
      @app_announcement = AppAnnouncement.find(params[:id])
    end

    def new
      @app_announcement = AppAnnouncement.new
    end

    def edit
      @app_announcement = AppAnnouncement.find(params[:id])
    end

    def create
      @app_announcement = AppAnnouncement.new(app_announcement_params)
      @app_announcement.author = current_user
      @save_result = @app_announcement.save

      if @save_result
        redirect_to admin_app_announcements_path
      else
        render 'new'
      end
    end

    def update
      @app_announcement = AppAnnouncement.find(params[:id])
      if @app_announcement.update(app_announcement_params)
        redirect_to admin_app_announcements_path
      else
        render 'edit'
      end
    end

    def destroy
      @app_announcement = AppAnnouncement.find(params[:id])
      @app_announcement.destroy
      redirect_to admin_app_announcements_path
    end

    private

    def app_announcement_params
      params.require(:app_announcement).permit(:text, :author_id)
    end
  end
end
