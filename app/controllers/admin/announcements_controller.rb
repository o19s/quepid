# frozen_string_literal: true

module Admin
  class AnnouncementsController < Admin::AdminController
    include Pagy::Method

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
      @announcement.publish_date = 1.day.from_now.to_date
      @announcement.expiration_date = 30.days.from_now.to_date
    end

    def edit
      @announcement = Announcement.find(params.expect(:id))
    end

    def create
      @announcement = Announcement.new(announcement_params)
      @announcement.author = current_user

      if @announcement.save
        redirect_to edit_admin_announcement_path(@announcement)
      else
        render 'new', status: :unprocessable_content
      end
    end

    def update
      @announcement = Announcement.find(params.expect(:id))

      if @announcement.update(announcement_params)
        render 'edit' # we stay on the edit page because that is where you can preview the rendered changes
      else
        render 'edit', status: :unprocessable_content
      end
    end

    def destroy
      @announcement = Announcement.find(params.expect(:id))
      @announcement.destroy
      redirect_to admin_announcements_path
    end

    private

    def announcement_params
      params.expect(announcement: [ :text, :author_id, :publish_date, :expiration_date ])
    end
  end
end
