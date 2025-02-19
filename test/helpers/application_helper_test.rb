# frozen_string_literal: true

require 'test_helper'

class ApplicationHelperTest < ActionView::TestCase
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

  let(:https_search_endpoint) { search_endpoints(:bootstrap_try_1) }
  def test_link_with_https_search_endpoint
    assert https_search_endpoint.endpoint_url.starts_with? 'https://'
    try_to_update = random_case.tries.first

    try_to_update.search_endpoint = https_search_endpoint
    try_to_update.save!

    try_number = random_case.tries.first.try_number
    options = {}

    # Call the helper method
    result = link_to_core_case('View Case', random_case, try_number, options)

    assert_includes result, 'https://'
  end
end
