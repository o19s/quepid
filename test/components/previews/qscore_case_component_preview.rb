# frozen_string_literal: true

# Preview for QscoreCaseComponent. View at /rails/view_components in development.
class QscoreCaseComponentPreview < ViewComponent::Preview
  def with_graph
    scores = (1..8).map do |i|
      { score: (rand * 10).round(2), updated_at: (Time.current - (8 - i).days).iso8601 }
    end
    annotations = [
      { message: "Tuned boost factor", updated_at: (Time.current - 5.days).iso8601 }
    ]
    render(QscoreCaseComponent.new(
      score: scores.last[:score],
      max_score: 10,
      score_label: "nDCG@10",
      scores: scores,
      annotations: annotations,
      case_id: 1
    ))
  end

  def without_graph
    render(QscoreCaseComponent.new(
      score: 7.5,
      max_score: 10,
      score_label: "P@10"
    ))
  end

  def unknown_score
    render(QscoreCaseComponent.new(score: "?", max_score: 10))
  end
end
