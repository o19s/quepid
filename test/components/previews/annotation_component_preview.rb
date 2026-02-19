# frozen_string_literal: true

# Preview for AnnotationComponent. View at /rails/view_components in development.
class AnnotationComponentPreview < ViewComponent::Preview
  def default
    user = User.new(id: 1, name: 'Demo User', email: 'demo@example.com')
    score = Score.new(id: 1, score: 85.5, try_id: 3, all_rated: true)
    annotation = Annotation.new(
      id:         1,
      message:    'Added new tokenizer and re-indexed',
      user:       user,
      score:      score,
      created_at: 2.hours.ago
    )
    render(AnnotationComponent.new(annotation: annotation, case_id: 1))
  end
end
