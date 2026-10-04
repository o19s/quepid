# frozen_string_literal: true

module ControllerConfiguration
  extend ActiveSupport::Concern

  def signup_enabled?
    Rails.application.config.signup_enabled
  end

  private

  def render_not_found_json exception
    resource_name = exception.model.presence || 'Resource'
    render json: { message: "#{resource_name.underscore.humanize} not found!" }, status: :not_found
  end
end
