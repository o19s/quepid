# frozen_string_literal: true

require "test_helper"

class TakeSnapshotComponentTest < ViewComponent::TestCase
  def test_renders_take_snapshot_trigger_when_allowed
    render_inline(TakeSnapshotComponent.new(
      case_id: 1,
      try_number: 1,
      search_engine: "solr",
      field_spec: "id,title",
      can_take_snapshot: true
    ))

    assert_selector ".take-snapshot-wrapper"
    assert_selector "a[data-action='click->take-snapshot#open']"
    assert_selector "#takeSnapshotModal"
  end

  def test_does_not_render_when_not_allowed
    render_inline(TakeSnapshotComponent.new(
      case_id: 1,
      try_number: 1,
      search_engine: "solr",
      can_take_snapshot: false
    ))

    assert_no_selector ".take-snapshot-wrapper"
  end

  def test_support_lookup_by_id_for_solr
    component = TakeSnapshotComponent.new(case_id: 1, search_engine: "solr")
    assert component.support_lookup_by_id?
  end

  def test_support_lookup_by_id_for_static
    component = TakeSnapshotComponent.new(case_id: 1, search_engine: "static")
    assert_not component.support_lookup_by_id?
  end
end
