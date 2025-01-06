# frozen_string_literal: true

require_relative '../lib/analytics'

class ApplicationController < ActionController::Base
  include Authentication::CurrentUserManager
  include Authentication::CurrentCaseManager
  include Authentication::CurrentBookManager

  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  # allow_browser versions: :modern

  respond_to :html, :js

  before_action :set_current_user
  before_action :require_login
  before_action :check_current_user_locked!

  # Prevent CSRF attacks by raising an exception.
  # For APIs, you may want to use :null_session instead.
  protect_from_forgery with: :exception

  private

  def deserialize_bool_param param
    ActiveRecord::Type::Boolean.new.deserialize(param) || false
  end

  def signup_enabled?
    Rails.application.config.signup_enabled
  end
end
