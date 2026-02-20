# frozen_string_literal: true

require 'test_helper'

class JudgementsComponentTest < ViewComponent::TestCase
  def test_renders_trigger_and_modal
    render_inline(
      JudgementsComponent.new(
        case_id:       1,
        case_name:     'My Case',
        book_id:       nil,
        queries_count: 0,
        scorer_id:     2,
        teams:         [ { id: 10, name: 'Team A' } ]
      )
    )
    assert_selector ".judgements-wrapper[data-controller='judgements']"
    assert_selector "[data-judgements-case-id-value='1']"
    assert_selector "a[data-action='click->judgements#open']"
    assert_selector '.modal', text: /Judgements/
    assert_selector "[data-judgements-target='bookList']"
    assert_selector "button[data-action='click->judgements#refreshFromBook']"
  end

  def test_renders_button_trigger_when_button_label_present
    render_inline(
      JudgementsComponent.new(
        case_id:       1,
        case_name:     'My Case',
        book_id:       nil,
        queries_count: 0,
        scorer_id:     2,
        teams:         [ { id: 10, name: 'Team A' } ],
        button_label:  'Filter Relevancy'
      )
    )
    assert_selector "button[data-action='click->judgements#open']", text: /Filter Relevancy/
    assert_no_selector "a[data-action='click->judgements#open']"
  end

  def test_no_teams_renders_no_teams_message
    render_inline(
      JudgementsComponent.new(
        case_id:   1,
        case_name: 'Case',
        teams:     []
      )
    )
    assert_selector "[data-judgements-target='noTeamsEl']"
  end
end
