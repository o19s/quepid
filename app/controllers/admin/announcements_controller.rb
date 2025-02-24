# frozen_string_literal: true

module Admin
  class AnnouncementsController < Admin::AdminController
    include Pagy::Backend
    def index
      query = Announcement.order(updated_at: :desc)
      if params[:q].present?
        query = query.where('text LIKE ?',
                            "%#{params[:q]}%")
      end

      @pagy, @announcements = pagy(query)
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
        redirect_to edit_admin_announcement_path(@announcement)
      else
        render 'new'
      end
    end

    def update
      @announcement = Announcement.find(params[:id])

      @announcement.update(announcement_params)

      render 'edit' # we stay on the edit page because that is where you can preview the rendered changes
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
      params.expect(announcement: [ :text, :author_id ])
    end
  end
end
