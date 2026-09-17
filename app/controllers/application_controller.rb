# frozen_string_literal: true

require_relative '../lib/analytics'

class ApplicationController < ActionController::Base
  include Authentication::CurrentUserManager
  include Authentication::CurrentCaseManager
  include Authentication::CurrentBookManager

  # Changes to the importmap will invalidate the etag for HTML responses
  stale_when_importmap_changes

  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  # allow_browser versions: :modern

  respond_to :html, :js

  rescue_from ActiveRecord::RecordNotFound do |exception|
    respond_to do |format|
      format.json { render_not_found_json(exception) }
      format.html { render file: Rails.public_path.join('404.html'), status: :not_found, layout: false }
      format.any { render file: Rails.public_path.join('404.html'), status: :not_found, layout: false }
    end
  end

  before_action :set_current_user
  before_action :require_login
  before_action :check_current_user_locked!

  before_action :turbo_frame_request_variant

  def turbo_frame_request_variant
    request.variant = :turbo_frame if turbo_frame_request?
  end

  # Prevent CSRF attacks by raising an exception.
  # For APIs, you may want to use :null_session instead.
  protect_from_forgery with: :exception

  private

  def render_not_found_json exception
    resource_name = exception.model.presence || 'Resource'
    render json: { message: "#{resource_name.underscore.humanize} not found!" }, status: :not_found
  end

  def deserialize_bool_param param
    ActiveRecord::Type::Boolean.new.deserialize(param) || false
  end

  def signup_enabled?
    Rails.application.config.signup_enabled
  end
end
