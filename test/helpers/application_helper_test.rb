# frozen_string_literal: true

require 'test_helper'

class ApplicationHelperTest < ActionView::TestCase
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
end
