# frozen_string_literal: true

# Preview for QgraphComponent. View at /rails/view_components in development.
class QgraphComponentPreview < ViewComponent::Preview
  def default
    scores = (1..10).map do |i|
      { score: (rand * 10).round(2), updated_at: (Time.current - (10 - i).days).iso8601 }
    end
    render(QgraphComponent.new(scores: scores, max_score: 10))
  end

  def with_annotations
    scores = (1..6).map do |i|
      { score: (rand * 10).round(2), updated_at: (Time.current - (6 - i).days).iso8601 }
    end
    annotations = [
      { message: "Tuned boost", updated_at: (Time.current - 4.days).iso8601 },
      { message: "Changed synonym list", updated_at: (Time.current - 2.days).iso8601 }
    ]
    render(QgraphComponent.new(scores: scores, annotations: annotations, max_score: 10))
  end
end
