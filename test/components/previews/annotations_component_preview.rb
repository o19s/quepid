# frozen_string_literal: true

# Preview for AnnotationsComponent. View at /rails/view_components in development.
class AnnotationsComponentPreview < ViewComponent::Preview
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
    render(AnnotationsComponent.new(
             case_id:     1,
             annotations: [ annotation ],
             last_score:  score
           ))
  end

  def no_score
    render(AnnotationsComponent.new(
             case_id:     1,
             annotations: [],
             last_score:  nil
           ))
  end

  def empty_list
    score = Score.new(id: 1, score: 50.0, try_id: 1, all_rated: false)
    render(AnnotationsComponent.new(
             case_id:     1,
             annotations: [],
             last_score:  score
           ))
  end
end
