# frozen_string_literal: true

require 'test_helper'

class AnnotationsComponentTest < ViewComponent::TestCase
  def setup
    @user = users(:doug)
    @score = Score.new(
      id:        1,
      score:     92.0,
      try_id:    2,
      all_rated: true,
      case_id:   1,
      user:      @user
    )
    @annotation = Annotation.new(
      id:         10,
      message:    'Baseline measurement',
      user:       @user,
      score:      @score,
      created_at: 1.day.ago
    )
  end

  def test_renders_create_form_and_annotations_list
    render_inline(AnnotationsComponent.new(
                    case_id:     1,
                    annotations: [ @annotation ],
                    last_score:  @score
                  ))

    assert_selector "[data-controller='annotations']"
    assert_selector "[data-annotations-case-id-value='1']"
    assert_selector "textarea[data-annotations-target='messageInput']"
    assert_selector "button[data-action='click->annotations#create']", text: 'Create'
    assert_selector '#annotations-list'
    assert_selector 'li.annotation', count: 1
    assert_selector '.annotation-message', text: 'Baseline measurement'
  end

  def test_renders_edit_modal
    render_inline(AnnotationsComponent.new(
                    case_id:     1,
                    annotations: [],
                    last_score:  @score
                  ))

    assert_selector '#editAnnotationModal.modal'
    assert_selector "textarea[data-annotations-target='editMessageInput']"
    assert_selector "button[data-action='click->annotations#updateAnnotation']", text: 'Update'
  end

  def test_shows_warning_when_no_score
    render_inline(AnnotationsComponent.new(
                    case_id:     1,
                    annotations: [],
                    last_score:  nil
                  ))

    assert_selector '.alert-warning', text: /No score recorded/
    assert_selector 'button[disabled]', text: 'Create'
  end

  def test_no_warning_when_score_present
    render_inline(AnnotationsComponent.new(
                    case_id:     1,
                    annotations: [],
                    last_score:  @score
                  ))

    assert_no_selector '.alert-warning'
    assert_no_selector 'button[disabled]'
  end

  def test_renders_last_score_json_value
    render_inline(AnnotationsComponent.new(
                    case_id:     1,
                    annotations: [],
                    last_score:  @score
                  ))

    assert_selector '[data-annotations-last-score-value]'
  end

  def test_renders_with_empty_annotations
    render_inline(AnnotationsComponent.new(
                    case_id:     1,
                    annotations: [],
                    last_score:  @score
                  ))

    assert_selector '#annotations-list'
    assert_no_selector 'li.annotation'
  end
end
