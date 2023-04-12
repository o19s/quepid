# frozen_string_literal: true

require 'test_helper'

class ApplicationHelperTest < ActionView::TestCase

  test 'A https search url and http quepid requires redirecting to http quepid' do
    safe_list_sanitizer = Rails::Html::SafeListSanitizer.new
    assert_equal "Bold no more!  <a href=\"more.html\">See more here</a>...", safe_list_sanitizer.sanitize("Bold</b> no more!  <a href='more.html'>See more here</a>...")
    assert_equal "<b>Bold</b><i>Trailing italics</i>", safe_list_sanitizer.sanitize("<b>Bold</b><i>Trailing italics")
  end
end
