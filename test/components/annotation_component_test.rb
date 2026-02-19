# frozen_string_literal: true

require 'test_helper'

class AnnotationComponentTest < ViewComponent::TestCase
  def setup
    @user = users(:doug)
    @score = Score.new(
      id:        1,
      score:     85.5,
      try_id:    3,
      all_rated: true,
      case_id:   1,
      user:      @user
    )
    @annotation = Annotation.new(
      id:         42,
      message:    'Added new tokenizer',
      user:       @user,
      score:      @score,
      created_at: 2.hours.ago
    )
  end

  def test_renders_annotation_with_message_and_score
    render_inline(AnnotationComponent.new(annotation: @annotation, case_id: 1))

    assert_selector "li.annotation[data-annotation-id='42']"
    assert_selector '.annotation-message', text: 'Added new tokenizer'
    assert_selector '.annotation-score', text: 'Score: 85.5'
    assert_selector '.annotation-try', text: 'Try No: 3'
  end

  def test_renders_user_name
    render_inline(AnnotationComponent.new(annotation: @annotation, case_id: 1))

    assert_selector '.annotation-source', text: /by/
  end

  def test_renders_time_ago
    render_inline(AnnotationComponent.new(annotation: @annotation, case_id: 1))

    assert_selector '.annotations-time', text: /ago/
  end

  def test_renders_edit_and_delete_actions
    render_inline(AnnotationComponent.new(annotation: @annotation, case_id: 1))

    assert_selector "a[data-action='click->annotations#openEditModal']", text: /Edit/
    assert_selector "a[data-action='click->annotations#deleteAnnotation']", text: /Delete/
  end

  def test_renders_stimulus_targets
    render_inline(AnnotationComponent.new(annotation: @annotation, case_id: 1))

    assert_selector "[data-annotations-target='annotation']"
    assert_selector "[data-annotations-target='messageDisplay']"
  end

  def test_escapes_annotation_message_in_data_attribute
    @annotation.message = 'Say "hello" to the world'
    result = render_inline(AnnotationComponent.new(annotation: @annotation, case_id: 1))
    html = result.to_html

    # Message with quotes must be HTML-escaped in the data attribute to avoid breaking the attribute
    edit_link = result.css("a[data-action='click->annotations#openEditModal']").first
    assert edit_link, 'Edit link should be present'
    assert_equal 'Say "hello" to the world', edit_link['data-annotation-message']
    # Raw HTML must not contain unescaped quote inside the attribute (would break the attribute)
    assert_includes html, '&quot;', 'Quotes in message should be escaped as &quot; in the attribute'
    assert_not_includes html, 'data-annotation-message="Say "hello"', 'Attribute value must not contain raw double quote'
  end
end
