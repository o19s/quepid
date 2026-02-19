# frozen_string_literal: true

require 'test_helper'

class ActionIconComponentTest < ViewComponent::TestCase
  def test_renders_icon_with_title
    render_inline(ActionIconComponent.new(
                    icon_class: 'bi bi-trash',
                    title:      'Delete'
                  ))
    assert_selector "a.action-icon[href='#']"
    assert_selector "i.bi.bi-trash[title='Delete'][aria-hidden='true']"
  end

  def test_renders_link_when_url_provided
    render_inline(ActionIconComponent.new(
                    icon_class: 'bi bi-share',
                    title:      'Share',
                    url:        'cases/1/share'
                  ))
    assert_selector "a.action-icon[href='cases/1/share']"
    assert_selector "i.bi.bi-share[title='Share']"
  end

  def test_merges_html_options
    render_inline(ActionIconComponent.new(
                    icon_class: 'bi bi-download',
                    title:      'Export',
                    data:       { action: 'click->workspace#openExport' }
                  ))
    assert_selector "a.action-icon[data-action='click->workspace#openExport']"
  end
end
