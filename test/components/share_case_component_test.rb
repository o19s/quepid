# frozen_string_literal: true

require 'test_helper'

class ShareCaseComponentTest < ViewComponent::TestCase
  def test_renders_share_trigger_with_data_attributes
    all_teams = [ { id: 1, name: 'Team A' }, { id: 2, name: 'Team B' } ]
    shared_teams = [ { id: 1, name: 'Team A' } ]
    render_inline(
      ShareCaseComponent.new(
        case_id:      42,
        case_name:    'My Case',
        all_teams:    all_teams,
        shared_teams: shared_teams,
        icon_only:    true
      )
    )
    assert_selector "button[data-controller='share-case']"
    assert_selector "button[data-action='click->share-case#open']"
    assert_selector "button[data-bs-toggle='modal']"
    assert_selector "button[data-bs-target='#shareCaseModal']"
    assert_selector "button[data-share-case-id-value='42']"
    assert_selector "button[data-share-case-name-value='My Case']"
    assert_selector 'button .bi-share'
  end

  def test_renders_share_case_text_when_not_icon_only
    render_inline(
      ShareCaseComponent.new(
        case_id:      1,
        case_name:    'Case',
        all_teams:    [],
        shared_teams: [],
        icon_only:    false
      )
    )
    assert_selector 'button .bi-share'
    assert_selector 'button', text: /Share case/
  end
end
