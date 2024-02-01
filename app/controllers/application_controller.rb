# frozen_string_literal: true

require 'application_responder'
require 'analytics'

class ApplicationController < ActionController::Base
  include Authentication::CurrentUserManager
  include Authentication::CurrentCaseManager
  include Authentication::CurrentBookManager

  self.responder = ApplicationResponder

  respond_to :html, :js
  before_action :set_current_user
  before_action :require_login
  before_action :check_current_user_locked!
  before_action :set_recent_cases
  before_action :check_for_announcement

  # Prevent CSRF attacks by raising an exception.
  # For APIs, you may want to use :null_session instead.
  protect_from_forgery with: :exception

  private

  def signup_enabled?
    Rails.application.config.signup_enabled
  end

  def check_for_announcement
    @announcement = Announcement.where(live: true).latest_unseen_for_user(@current_user).first if @current_user
    AnnouncementViewed.create(user: @current_user, announcement: @announcement) if @announcement
  end
end
