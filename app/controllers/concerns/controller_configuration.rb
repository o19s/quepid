# frozen_string_literal: true

module ControllerConfiguration
  extend ActiveSupport::Concern

  def signup_enabled?
    Rails.application.config.signup_enabled
  end

  private

  # These controllers retain intentional entry/session effects. Speculative GETs
  # must stop before authentication, tracking, or action callbacks can run.
  def reject_prefetch
    purposes = %w[X-Sec-Purpose Sec-Purpose Purpose].filter_map { |header| request.headers[header] }
    return unless (request.get? || request.head?) && purposes.any? { |purpose| purpose.match?(/\bprefetch\b/i) }

    response.cache_control.replace(private: true, no_store: true)
    head :bad_request
  end

  def render_not_found_json exception
    resource_name = exception.model.presence || 'Resource'
    render json: { message: "#{resource_name.underscore.humanize} not found!" }, status: :not_found
  end
end
