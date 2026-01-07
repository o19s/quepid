# frozen_string_literal: true

require 'test_helper'

class MarkdownHelperTest < ActionView::TestCase
  include MarkdownHelper

  test 'renders basic markdown to HTML' do
    result = render_markdown('**bold** and *italic*')
    assert_includes result, '<strong>bold</strong>'
    assert_includes result, '<em>italic</em>'
  end

  test 'renders markdown tables' do
    markdown = <<~MD
      | Header 1 | Header 2 |
      |----------|----------|
      | Cell 1   | Cell 2   |
    MD

    result = render_markdown(markdown)
    assert_includes result, '<table>'
    assert_includes result, '<th>Header 1</th>'
    assert_includes result, '<td>Cell 1</td>'
  end

  test 'renders markdown links with target blank' do
    result = render_markdown('[Link](https://example.com)')
    assert_includes result, '<a href="https://example.com"'
    assert_includes result, 'target="_blank"'
  end

  test 'returns empty string for blank input' do
    assert_equal '', render_markdown(nil)
    assert_equal '', render_markdown('')
    assert_equal '', render_markdown('   ')
  end

  test 'sanitizes dangerous HTML' do
    result = render_markdown('<script>alert("xss")</script>')
    assert_not_includes result, '<script>'
  end
end
