# frozen_string_literal: true

# rubocop:disable Metrics/ModuleLength
module ApplicationHelper
  # Returns the Quepid application root URL (no trailing slash).
  # Use this instead of hardcoding '/' or using caseTryNavSvc.getQuepidRootUrl() in migrated JS.
  # Respects RAILS_RELATIVE_URL_ROOT so deployment under a subpath works.
  # Exposed in core_modern layout as data-quepid-root-url for Stimulus/JS.
  def quepid_root_url
    root_url.chomp('/')
  end

  def book_title book
    if book.name.downcase.starts_with?('book')
      book.name.titleize
    else
      "Book #{book.name.titleize}"
    end
  end

  def strip_book_title book
    book.name.sub(/^book\s+/i, '').titleize
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

    path_params = {}

    search_endpoint = kase.tries.first&.search_endpoint

    if search_endpoint && !search_endpoint.proxy_requests? && search_endpoint.endpoint_url
      protocol = get_protocol_from_url(search_endpoint.endpoint_url)
      path_params = {
        protocol: protocol,
        port:     'https' == protocol ? 443 : nil,
      }.compact
    end

    path = case_core_url(kase, try_number, **path_params)
    # Call the original link_to method with the modified options
    link_to(name, path, options)
  end

  def get_protocol_from_url url
    UrlParserService.scheme(url)
  end
end
# rubocop:enable Metrics/ModuleLength
