# frozen_string_literal: true

require 'test_helper'

class ExpandContentComponentTest < ViewComponent::TestCase
  def test_renders_trigger_and_modal
    render_inline(ExpandContentComponent.new(
                    id:            'expand-modal-1',
                    title:         'Relevancy Score: 1.5',
                    body:          'explain text here',
                    trigger_label: 'Expand'
                  ))
    assert_selector ".expand-content-wrapper[data-controller='expand-content']"
    assert_selector "button[data-action='click->expand-content#open']", text: /Expand/
    assert_selector '#expand-modal-1.modal'
    assert_selector '#expand-modal-1 .modal-title', text: 'Relevancy Score: 1.5'
    assert_selector '#expand-modal-1 pre', text: 'explain text here'
  end

  def test_custom_trigger_label
    render_inline(ExpandContentComponent.new(
                    id:            'expand-2',
                    title:         'Title',
                    body:          'Body',
                    trigger_label: 'View full'
                  ))
    assert_selector "button[data-action='click->expand-content#open']", text: /View full/
  end
end
