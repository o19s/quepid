# frozen_string_literal: true

require 'test_helper'

class ImportRatingsComponentTest < ViewComponent::TestCase
  def test_renders_trigger_and_modal
    render_inline(
      ImportRatingsComponent.new(case_id: 1, case_name: 'My Case', icon_only: true)
    )
    assert_selector ".import-ratings-wrapper[data-controller='import-ratings']"
    assert_selector "[data-import-ratings-case-id-value='1']"
    assert_selector "a[data-action='click->import-ratings#open']"
    assert_selector '.modal', text: /Import into Case/
    assert_selector '#tab-ratings'
    assert_selector '#tab-info-needs'
    assert_selector "button[data-import-ratings-target='submitBtn']", text: 'Import'
  end

  def test_ratings_tab_has_format_options
    render_inline(
      ImportRatingsComponent.new(case_id: 1, case_name: 'Case', icon_only: false)
    )
    assert_selector '#fmt-csv'
    assert_selector '#fmt-rre'
    assert_selector '#fmt-ltr'
    assert_selector '#import-clear-queries'
  end

  def test_info_needs_tab_has_create_queries
    render_inline(
      ImportRatingsComponent.new(case_id: 1, case_name: 'Case', icon_only: false)
    )
    assert_selector '#import-create-queries'
    assert_selector "textarea[data-import-ratings-target='infoNeedsText']"
  end
end
