# frozen_string_literal: true

require 'test_helper'

class ApplicationHelperTest < ActionView::TestCase
  test 'codemirror data retains optional editor settings and caller targets' do
    data = codemirror_data(mode: 'application/json', height: 100, width: 500, readonly: true,
                           line_numbers: false, mapper_wizard_target: 'customHeaders')

    assert_equal 'codemirror', data[:controller]
    assert_equal 'application/json', data[:codemirror_mode]
    assert_equal 100, data[:codemirror_height]
    assert_equal 500, data[:codemirror_width]
    assert data[:codemirror_readonly]
    assert_not data[:codemirror_line_numbers]
    assert data.key?(:codemirror_line_numbers)
    assert_equal 'customHeaders', data[:mapper_wizard_target]
    assert_equal 'turbo:before-cache@document->codemirror#teardown', data[:action]
  end

  test 'codemirror data leaves unspecified settings absent' do
    data = codemirror_data(mode: 'javascript', height: 200)

    assert_not data.key?(:codemirror_width)
    assert_not data.key?(:codemirror_readonly)
    assert_not data.key?(:codemirror_line_numbers)
  end

  test 'codemirror data preserves editors without a before-cache action' do
    data = codemirror_data(mode: 'json', height: 300, before_cache: false, ai_judge_wizard_target: 'documentFields')

    assert_not data.key?(:action)
    assert_equal 'documentFields', data[:ai_judge_wizard_target]
  end

  test 'active navigation ignores section names in query parameters' do
    @request.env['PATH_INFO'] = '/teams/1'
    @request.env['QUERY_STRING'] = 'cases_q=case&books_q=book&scorers_q=scorers&search_endpoints_q=search_endpoint'

    assert make_active?(path: 'teams')
    %w[case book scorers search_endpoint].each do |path|
      assert_not make_active?(path: path), "Query parameters must not activate #{path} navigation"
    end
  end

  test 'active navigation retains matching on nested section paths' do
    @request.env['PATH_INFO'] = '/books/1/judgements'
    @request.env['QUERY_STRING'] = 'q=teams'

    assert make_active?(path: 'book')
    assert_not make_active?(path: 'teams')
  end

  test 'group_button_to nests its form as a btn-group carrying the Turbo confirmation' do
    html = group_button_to('/books/1/unarchive', method: :patch, button_class: 'text-success p-0',
                           title: 'Unarchive book', confirm: 'Unarchive Book 1?', confirm_style: 'primary') { 'icon' }
    form = Nokogiri::HTML.fragment(html).at_css('form')

    assert_equal 'btn-group btn-group-sm', form['class']
    assert_equal 'Unarchive Book 1?', form['data-turbo-confirm']
    assert_equal 'primary', form['data-turbo-confirm-style']
    assert_equal 'patch', form.at_css('input[name=_method]')['value']
    button = form.at_css('button')
    assert_equal 'btn btn-link ms-0 text-success p-0', button['class']
    assert_equal 'Unarchive book', button['title']
  end

  test 'group_button_to omits the confirm style when none is given' do
    form = Nokogiri::HTML.fragment(group_button_to('/books/1/archive', method: :patch, button_class: 'p-0',
                                                   confirm: 'Archive?') { 'icon' }).at_css('form')

    assert_nil form['data-turbo-confirm-style']
  end

  test 'share_modal_button targets the record type modal and carries the values its controller reads' do
    search_endpoint = SearchEndpoint.new(id: 7)
    button = Nokogiri::HTML.fragment(share_modal_button('search_endpoint', search_endpoint, name: 'Solr', url: '/share/7',
                                                        button_class: 'me-2')).at_css('button')

    assert_equal 'btn btn-link p-0 me-2', button['class']
    assert_equal '#shareSearchEndpointModal', button['data-bs-target']
    assert_equal '7', button['data-share-search-endpoint-id-value']
    assert_equal 'Solr', button['data-share-search-endpoint-name-value']
    assert_equal '/share/7', button['data-share-search-endpoint-url-value']
  end

  test 'archive_toggle_button picks the url, label and confirm style from the archived state' do
    urls = { archive: '/cases/1/archive', unarchive: '/cases/1/unarchive' }

    archived = Nokogiri::HTML.fragment(archive_toggle_button(Case.new(archived: true), name: 'Movies', urls: urls)).at_css('form')
    assert_equal '/cases/1/unarchive', archived['action']
    assert_equal 'Unarchive Movies?', archived['data-turbo-confirm']
    assert_equal 'primary', archived['data-turbo-confirm-style']
    assert_equal 'Unarchive case', archived.at_css('button')['aria-label']

    active = Nokogiri::HTML.fragment(archive_toggle_button(Case.new(archived: false), name: 'Movies', urls: urls,
                                                           group: false)).at_css('form')
    assert_equal '/cases/1/archive', active['action']
    assert_equal 'd-inline', active['class']
    assert_nil active['data-turbo-confirm-style']
    assert_equal 'btn btn-link text-warning p-0', active.at_css('button')['class']
  end

  test 'metric_card colors the value, icon and border and renders the block below the caption' do
    html = metric_card('42%', 'Fully Judged', '3 of 7 pairs', icon: 'bi-trophy', color: 'success') { 'extra' }
    card = Nokogiri::HTML.fragment(html).at_css('.card')

    assert_includes card['class'], 'border-success'
    assert_equal '42%', card.at_css('.display-5.text-success').text
    assert_equal 'Fully Judged', card.at_css('h6').text.strip
    assert card.at_css('h6 i.bi.bi-trophy.text-success')
    assert_equal '3 of 7 pairs', card.at_css('p.card-text').text
    assert_equal 'extra', card.at_css('.card-body').children.last.text.strip
  end

  test 'layout_body_attributes gives non-case pages the flex shell and page cache' do
    attributes = layout_body_attributes(case_page: false)

    assert_equal 'd-flex flex-column min-vh-100', attributes[:class]
    assert_equal 'page-cache', attributes[:data][:controller]
    assert_equal 'turbo:before-cache@document->page-cache#prepare', attributes[:data][:action]
    assert_equal quepid_root_url, attributes[:data][:quepid_root_url]
  end

  test 'sanitize_announcement keeps class, safe inline style and images' do
    text = '<p class="text-danger" style="color: red; position: fixed; background-image: url(javascript:alert(1))">Hi</p>' \
           '<img src="https://example.com/a.png" alt="A" class="img-fluid" onerror="steal()">'
    html = Nokogiri::HTML5.fragment(sanitize_announcement(text))

    paragraph = html.at_css('p.text-danger')
    assert_equal 'color:red;', paragraph['style']
    image = html.at_css('img.img-fluid')
    assert_equal 'https://example.com/a.png', image['src']
    assert_equal 'A', image['alt']
    assert_nil image['onerror']
  end

  test 'sanitize_announcement strips scripts and javascript URLs' do
    text = '<a href="javascript:alert(1)">x</a><img src="javascript:alert(1)"><script>alert(1)</script>'
    html = Nokogiri::HTML5.fragment(sanitize_announcement(text))

    assert_nil html.at_css('a')['href']
    assert_nil html.at_css('img')['src']
    assert_nil html.at_css('script')
  end

  test 'quepid_root_url returns application root without trailing slash' do
    assert_equal root_url.chomp('/'), quepid_root_url
  end

  test 'quepid_root_url includes request SCRIPT_NAME for subpath deployments' do
    @request.env['SCRIPT_NAME'] = '/quepid-app'

    assert_equal 'http://test.host/quepid-app', quepid_root_url
  end

  test 'understand how the rails sanitize command works with some examples of snippetted text' do
    safe_list_sanitizer = Rails::Html::SafeListSanitizer.new
    assert_equal 'Bold no more!  <a href="more.html">See more here</a>...',
                 safe_list_sanitizer.sanitize("Bold</b> no more!  <a href='more.html'>See more here</a>...")
    assert_equal '<b>Bold</b><i>Trailing italics</i>', safe_list_sanitizer.sanitize('<b>Bold</b><i>Trailing italics')
  end

  let(:random_case) { cases(:random_case) }
  def test_link_to_core_case
    try_number = 2
    expected_link_text = 'View Case'
    expected_path = case_core_url(random_case, try_number)

    # Call the helper method
    result = link_to_core_case(expected_link_text, random_case, try_number)

    # Assertions
    assert_includes result, expected_link_text
    assert_includes result, expected_path
    assert_includes result, "href=\"#{expected_path}\""
  end

  def test_link_to_core_case_with_options
    try_number = 2
    options = { class: 'btn btn-primary' }

    # Call the helper method
    result = link_to_core_case('View Case', random_case, try_number, options)

    # Assertions for the options
    assert_includes result, 'class="btn btn-primary"'
  end

  describe 'flash_messages' do
    test 'renders a dismissible alert for a displayable flash message' do
      flash[:notice] = 'Saved successfully.'
      self.output_buffer = ActionView::OutputBuffer.new

      flash_messages

      rendered = output_buffer.to_s
      assert_includes rendered, 'Saved successfully.'
      assert_includes rendered, 'alert-info'
      assert_includes rendered, 'alert-dismissible'
    end

    test 'maps each flash type to its bootstrap alert class' do
      flash[:success] = 'Success message'
      flash[:error] = 'Error message'
      flash[:alert] = 'Alert message'
      self.output_buffer = ActionView::OutputBuffer.new

      flash_messages

      rendered = output_buffer.to_s
      assert_includes rendered, 'alert-success'
      assert_includes rendered, 'alert-danger'
      assert_includes rendered, 'alert-warning'
    end

    test 'suppresses structural, non-displayable flash keys' do
      flash[:unfurl] = 'true'
      flash[:kraken_unleashed] = 'true'
      self.output_buffer = ActionView::OutputBuffer.new

      flash_messages

      assert_equal '', output_buffer.to_s.strip
    end

    test 'only success and notice dismiss automatically and all flashes are one-time' do
      [ :success, :notice, :error, :alert, :warning ].each { |type| flash[type] = "#{type} message" }
      self.output_buffer = ActionView::OutputBuffer.new

      flash_messages

      alerts = Nokogiri::HTML.fragment(output_buffer.to_s).css('[role="alert"]')
      assert_equal 5, alerts.size
      alerts.each do |alert|
        assert_equal 'true', alert['data-turbo-temporary']
        assert_equal 'Close', alert.at_css('button')['aria-label']
        if %w[success notice].any? { |type| alert.text == "#{type} message" }
          assert_equal 'auto-dismiss', alert['data-controller']
          assert_includes alert['data-action'], 'focusout->auto-dismiss#schedule'
        else
          assert_nil alert['data-controller']
        end
      end
    end
  end

  describe 'Smart handling of links to HTTPS search end points' do
    let(:https_search_endpoint) { search_endpoints(:bootstrap_try_1) }

    test 'link with https search_endpoint' do
      try_to_update = random_case.tries.first

      try_to_update.search_endpoint = https_search_endpoint
      try_to_update.save!

      try_number = random_case.tries.first.try_number
      options = {}

      # Call the helper method
      result = link_to_core_case('View Case', random_case, try_number, options)

      assert_includes result, 'https://'
    end

    test 'Proxied https endpoints do not change' do
      https_search_endpoint.update(proxy_requests: true)

      try_to_update = random_case.tries.first

      try_to_update.search_endpoint = https_search_endpoint
      try_to_update.save!

      try_number = random_case.tries.first.try_number
      options = { class: 'btn btn-primary' }

      # Call the helper method
      result = link_to_core_case('View Case', random_case, try_number, options)

      assert_includes result, 'http://'
    end
  end

  test 'book and case titles keep names as typed' do
    assert_equal 'Book ES McKey', book_title(Book.new(name: 'ES McKey'))
    assert_equal 'book ES', book_title(Book.new(name: 'book ES'))
    assert_equal 'Case ES McKey', case_title(Case.new(case_name: 'ES McKey'))
    assert_equal 'case ES', case_title(Case.new(case_name: 'case ES'))
  end
end
