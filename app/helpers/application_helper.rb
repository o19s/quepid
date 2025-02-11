# frozen_string_literal: true

# rubocop:disable Metrics/ModuleLength
module ApplicationHelper
  def book_title book
    if book.name.downcase.starts_with?('book')
      book.name.titleize
    else
      "Book #{book.name.titleize}"
    end
  end

  def case_title kase
    if kase.case_name.downcase.starts_with?('case')
      kase.case_name.titleize
    else
      "Case #{kase.case_name.titleize}"
    end
  end

  def display_judge_name judge
    judge.nil? ? 'anonymous' : judge.fullname
  end

  def make_active? options
    if options.key?(:path)
      request.fullpath.include?(options[:path])
    elsif options.key?(:controller)
      controller_name == options[:controller]
    elsif options.key?(:action)
      action_name == options[:action]
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

  def button_to_if condition, name, options = {}, html_options = {}
    button_to(name, options, html_options) if condition
  end

  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Lint/EmptyBlock
  def flash_messages _opts = {}
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

  def document_fields_parses_as_json document_fields
    begin
      document_fields = JSON.parse document_fields
    rescue StandardError
      document_fields = nil
    end

    document_fields = nil unless document_fields.respond_to?(:keys)

    document_fields
  end

  # Override default form_for to disable Turbo Drive on
  # Forms.  Maybe should be an ENV variable?
  # caused by https on front end attempting to make http
  # call by Turbo Drive and getting mix mode errros
  # rubocop:disable Naming/BlockForwarding
  def form_for record, options = {}, &block
    if options[:html].nil?
      options[:html] = { data: { turbo: false } }
    elsif options[:html][:data].nil?
      options[:html][:data] = { turbo: false }
    end
    super
  end
  # rubocop:enable Naming/BlockForwarding

  def form_with_disabled( **options, &)
    if options[:html].nil?
      options[:html] = { data: { turbo: false } }
    elsif options[:html][:data].nil?
      options[:html][:data] = { turbo: false }
    end

    # Call the original `form_with` method with the modified options
    super
  end

  # Match the link to the core case url with the endpoint_url
  # if we have one.  Avoids a swap in the core application.
  def link_to_core_case name, kase, try_number, options = {}
    # Ensure options[:data] is set to { turbo_prefetch: false }
    options[:data] ||= {}
    options[:data][:turbo_prefetch] = false

    endpoint_url = kase.tries.first&.search_endpoint&.endpoint_url
    protocol = nil
    if endpoint_url
      protocol = get_protocol_from_url(endpoint_url)
      port = 443 if 'https' == protocol
    end
    path = case_core_url(kase, try_number, protocol: protocol, port: port)

    # Call the original link_to method with the modified options
    link_to(name, path, options)
  end

  def get_protocol_from_url url
    parsed_url = URI.parse(url)
    protocol = parsed_url.scheme # This gets the protocol (http, https, etc.)
    protocol
  rescue URI::InvalidURIError => e
    # Handle the error (e.g., log it, return nil)
    Rails.logger.error("Invalid URL for search endpoint: #{url} - Error: #{e.message}")
    nil
  end

  def determine_prefer_ssl
    Rails.configuration.prefer_ssl ? 'https' : 'http'
  end
end
# rubocop:enable Metrics/ModuleLength
