# frozen_string_literal: true

# rubocop:disable-next Metrics/ModuleLength
module ApplicationHelper
  # Returns the Quepid application root URL (no trailing slash).
  # Respects RAILS_RELATIVE_URL_ROOT so deployment under a subpath works.
  # Exposed on <body> as data-quepid-root-url for Stimulus/JS navigation fallbacks.
  def quepid_root_url
    "#{request.base_url}#{request.script_name}".chomp('/')
  end

  # <body> attributes for the application layout. The core case page boots its
  # Stimulus bridges from these values; every other page gets the flex shell
  # and the Turbo page cache.
  def layout_body_attributes case_page:, kase: nil, try: nil
    unless case_page
      return { class: 'd-flex flex-column min-vh-100',
               data:  { controller: 'page-cache', action: 'turbo:before-cache@document->page-cache#prepare',
                        quepid_root_url: quepid_root_url } }
    end

    { data: {
      controller:                          'snapshot-bridge core-bootstrap query-command-bridge',
      core_bootstrap_case_toolbar_outlet:  '#case-actions',
      core_bootstrap_case_no_value:        kase&.id || 0,
      # String.new drops html_safe so the JSON is attribute-escaped.
      core_bootstrap_initial_value:        String.new(render(partial: 'core/bootstrap', formats: [ :json ],
                                                             locals: { kase: kase })),
      snapshot_bridge_snapshots_url_value: kase ? api_case_snapshots_path(kase) : '',
      # Preserve an explicitly requested missing try so core-bootstrap can report it.
      core_bootstrap_try_no_value:         params[:try_number].presence || try&.try_number || '',
      quepid_root_url:                     quepid_root_url,
    } }
  end

  # Announcements are admin-authored HTML. The default safe list already allows
  # class and img; add inline style, whose CSS Loofah filters to safe properties.
  def sanitize_announcement text
    sanitize text, attributes: Rails::HTML5::SafeListSanitizer.allowed_attributes + [ 'style' ]
  end

  # Names are shown as the user typed them; titleize would mangle acronyms
  # ("ES" -> "Es") and mixed case ("McKey" -> "Mc Key").
  def book_title book
    if book.name.downcase.starts_with?('book')
      book.name
    else
      "Book #{book.name}"
    end
  end

  # Renders the shared page-header bar: an <h1> title plus an optional right-aligned
  # actions block (buttons, toolbar, stats -- whatever the page needs).
  def page_header title, &block
    render 'shared/page_header', title: title, actions: (block ? capture(&block) : nil)
  end

  # The one create action in an index page's header. Secondary header actions
  # (imports, exports, wizards) sit beside it as btn-outline-secondary.
  def page_create_button label, path, data: {}
    link_to path, class: 'btn btn-sm btn-primary', data: data do
      safe_join([ tag.i(class: 'bi bi-plus-lg', aria: { hidden: true }), label ], ' ')
    end
  end

  # Bordered stat card: a large colored value over an icon label and a muted
  # caption. The block, if any, renders extra content (progress bar, actions) below.
  def metric_card value, label, caption, icon:, color:, &block
    render 'shared/metric_card', value: value, label: label, caption: caption, icon: icon, color: color,
                                 extra: (block ? capture(&block) : nil)
  end

  # Keep editor configuration shared while callers own the textarea and its form data.
  def codemirror_data mode:, height:, before_cache: true, **options
    data = options.extract!(:width, :readonly, :line_numbers).transform_keys { |key| :"codemirror_#{key}" }
    data.merge!(options, controller: 'codemirror', codemirror_mode: mode, codemirror_height: height)
    data[:action] = 'turbo:before-cache@document->codemirror#teardown' if before_cache
    data
  end

  # Divider <li> for the shared account-dropdown menu (shared/_account_dropdown).
  # :hr is a standard Bootstrap divider (plain Rails nav). :separator is an
  # empty role="separator" <li> that core's header-scoped CSS
  # (core-additions.css `header .dropdown-menu > li`) turns into a divider via
  # its border-bottom -- the two surfaces can't share one divider style.
  def account_dropdown_divider style
    case style
    when :hr
      content_tag(:li, tag.hr(class: 'dropdown-divider'))
    when :separator
      content_tag(:li, '', role: 'separator')
    else
      raise ArgumentError, "unknown account dropdown divider style: #{style.inspect}"
    end
  end

  def case_title kase
    if kase.case_name.downcase.starts_with?('case')
      kase.case_name
    else
      "Case #{kase.case_name}"
    end
  end

  def display_judge_name judge
    judge.nil? ? 'anonymous' : judge.fullname
  end

  def make_active? options
    if options.key?(:path)
      request.path.include?(options[:path])
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
      notice:  'alert-success',
    }[flash_type.to_sym] || flash_type.to_s
  end

  def button_to_if condition, name, options = {}, html_options = {}
    button_to(name, options, html_options) if condition
  end

  # Icon button_to inside a .btn-group, confirmed through the shared modal.
  # The form is itself a nested .btn-group so Bootstrap's `> .btn` sizing and
  # -1px overlap still apply; ms-0 cancels the extra overlap the hidden
  # _method input of a PATCH/DELETE form would otherwise add.
  def group_button_to(url, confirm:, button_class:, confirm_style: nil, **html_options, &)
    form_data = { turbo_confirm: confirm, turbo_confirm_style: confirm_style }.compact
    button_to(url, html_options.merge(class: "btn btn-link ms-0 #{button_class}",
                                      form:  { class: 'btn-group btn-group-sm', data: form_data }), &)
  end

  # Row icon button opening the index/team share modal (shared/_share_entity_modal)
  # for a "case", "book", "scorer" or "search_endpoint". The modal's controller reads
  # the name and url values off the clicked button; specs find rows by the id value.
  def share_modal_button record_type, record, name:, url: share_modal_path(record_type, record), button_class: nil
    prefix = "share_#{record_type}"
    data = { bs_toggle: 'modal', bs_target: "##{prefix.camelize(:lower)}Modal",
             "#{prefix}_id_value": record.id, "#{prefix}_name_value": name, "#{prefix}_url_value": url }
    button_tag type: 'button', class: [ 'btn btn-link p-0', button_class ].compact.join(' '),
               title: 'Share', aria: { label: 'Share' }, data: data do
      tag.i class: 'bi bi-share', aria: { hidden: true }
    end
  end

  # Row icon button that archives or unarchives `record`, confirmed through the
  # shared modal. `urls` holds the :archive and :unarchive paths. `group: false`
  # renders it as a plain inline form instead of a nested .btn-group (see group_button_to).
  def archive_toggle_button record, name:, urls:, method: :post, group: true
    verb = record.archived? ? 'Unarchive' : 'Archive'
    label = "#{verb} #{record.model_name.human.downcase}"
    color = record.archived? ? 'text-success' : 'text-warning'
    confirm_style = 'primary' if record.archived?
    url = urls.fetch(record.archived? ? :unarchive : :archive)
    icon = safe_join([ tag.i(class: 'bi bi-folder-check', aria: { hidden: true }), tag.span(label, class: 'visually-hidden') ])

    if group
      group_button_to(url, method: method, button_class: "#{color} p-0 me-3", title: label, aria: { label: label },
                           confirm: "#{verb} #{name}?", confirm_style: confirm_style) { icon }
    else
      form_data = { turbo_confirm: "#{verb} #{name}?", turbo_confirm_style: confirm_style }.compact
      button_to(url, method: method, class: "btn btn-link #{color} p-0", title: label, aria: { label: label },
                     form: { class: 'd-inline', data: form_data }) { icon }
    end
  end

  # Flash keys that are structural flags consumed by a dedicated partial/controller,
  # not user-facing messages, so the generic flash banner must not render them.
  NON_DISPLAYABLE_FLASH_KEYS = %w[unfurl kraken_unleashed].freeze

  # rubocop:disable-next Lint/EmptyBlock
  def flash_messages _opts = {}
    flash.each do |msg_type, message|
      next if NON_DISPLAYABLE_FLASH_KEYS.include?(msg_type.to_s)

      concat(
        content_tag(
          :div,
          message,
          class: "alert #{bootstrap_class_for(msg_type)} fade show",
          role:  'alert',
          data:  flash_message_data(msg_type)
        ) do
          concat(
            content_tag(
              :button,
              class:        'btn-close float-start',
              type:         'button',
              'aria-label': 'Close',
              data:         { 'bs-dismiss': 'alert' }
            ) do
            end
          )
          concat content_tag(:span, message)
        end
      )
    end

    nil
  end

  def desktop_mode?
    Rails.application.config.desktop_mode
  end

  def require_proxy_for_all_search_endpoints?
    Rails.application.config.require_proxy_for_all_search_endpoints
  end

  def flash_message_data msg_type
    data = { turbo_temporary: true }
    if %w[success notice].include?(msg_type.to_s)
      data[:controller] = 'auto-dismiss'
      data[:action] = 'mouseenter->auto-dismiss#pause mouseleave->auto-dismiss#schedule ' \
                      'focusin->auto-dismiss#pause focusout->auto-dismiss#schedule'
    end
    data
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
    parsed_url = Addressable::URI.parse(url)
    protocol = parsed_url.scheme # This gets the protocol (http, https, etc.)
    protocol
  rescue Addressable::URI::InvalidURIError => e
    # Handle the error (e.g., log it, return nil)
    Rails.logger.error("Invalid URL for search endpoint: #{url} - Error: #{e.message}")
    nil
  end
end
