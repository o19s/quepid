# frozen_string_literal: true

# Renders a single annotation item with kebab menu for edit/delete.
# Replaces the Angular annotation component.
#
# Data attributes that carry annotation_message use html_escape (h) so that
# quotes and other special characters in the message cannot break the attribute
# or cause attribute injection.
#
# @see docs/view_component_conventions.md
class AnnotationComponent < ApplicationComponent
  # @param annotation [Annotation] AR object (with score and user loaded)
  # @param case_id [Integer] Case id for API calls
  def initialize annotation:, case_id:
    @annotation = annotation
    @case_id    = case_id
  end

  def time_ago_text
    return '' unless @annotation.created_at

    "#{time_ago_in_words(@annotation.created_at)} ago"
  end

  def display_score
    @annotation.score&.score
  end

  def display_try
    @annotation.score&.try_id
  end

  def display_user
    @annotation.user&.display_name
  end

  def annotation_message
    @annotation.message
  end

  def annotation_id
    @annotation.id
  end
end
