# frozen_string_literal: true

module ApplicationHelper
  def make_active? options
    if options.key?(:path)
      request.fullpath.include?(options[:path])
    elsif options.key?(:controller)
      controller_name == options[:controller]
    end
  end

  def bootstrap_class_for flash_type
    {
      success: 'alert-success',
      error:   'alert-danger',
      alert:   'alert-warning',
      notice:  'alert-info',
    }[flash_type.to_sym] || flash_type.to_s
  end

  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Lint/EmptyBlock
  def flash_messages_bs5 _opts = {}
    flash.each do |msg_type, message|
      next if 'unfurl' == msg_type # we don't show unfurl's in the flash notice UI.

      concat(
        content_tag(
          :div,
          message,
          class: "alert #{bootstrap_class_for(msg_type)} alert-dismissible fade show",
          role:  'alert'
        ) do
          concat(
            content_tag(
              :button,
              class: 'btn-close',
              data:  { 'bs-dismiss': 'alert' }
            ) do
            end
          )
          concat message
        end
      )
    end

    nil
  end
  # rubocop:enable Lint/EmptyBlock
  # rubocop:enable Metrics/MethodLength

  # rubocop:disable Metrics/MethodLength
  def flash_messages _opts = {}
    flash.each do |msg_type, message|
      next if 'unfurl' == msg_type # we don't show unfurl's in the flash notice UI.

      concat(
        content_tag(
          :div,
          message,
          class: "alert #{bootstrap_class_for(msg_type)} alert-dismissible",
          role:  'alert'
        ) do
          concat(
            content_tag(
              :button,
              class: 'close',
              data:  { dismiss: 'alert' }
            ) do
              concat(
                content_tag(:span, '&times;'.html_safe, 'aria-hidden' => true)
              )
              concat content_tag(:span, 'Close', class: 'sr-only')
            end
          )
          concat message
        end
      )
    end

    nil
  end

  # rubocop:enable Metrics/MethodLength
  def document_fields_parses_as_json document_fields
    begin
      document_fields = JSON.parse document_fields
    rescue StandardError
      document_fields = nil
    end

    document_fields = nil unless document_fields.respond_to?(:keys)

    document_fields
  end
end
