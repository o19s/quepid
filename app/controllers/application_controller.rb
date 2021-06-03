# frozen_string_literal: true

require 'application_responder'
require 'analytics'

class ApplicationController < ActionController::Base
  include Authentication::CurrentUserManager
  include Authentication::CurrentCaseManager

  self.responder = ApplicationResponder

  respond_to :html, :js
  before_action :set_current_user
  before_action :require_login
  before_action :check_current_user_locked!

  # Prevent CSRF attacks by raising an exception.
  # For APIs, you may want to use :null_session instead.
  protect_from_forgery with: :exception

  private

  def ssl_enabled?
    'true' == ENV['FORCE_SSL']
  end

  def signup_enabled?
    Rails.application.config.signup_enabled
  end
end
