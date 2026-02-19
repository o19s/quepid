# frozen_string_literal: true

# Preview for QscoreQueryComponent. View at /rails/view_components in development.
class QscoreQueryComponentPreview < ViewComponent::Preview
  def high_score
    render(QscoreQueryComponent.new(score: 9.2, max_score: 10))
  end

  def mid_score
    render(QscoreQueryComponent.new(score: 5.0, max_score: 10))
  end

  def low_score
    render(QscoreQueryComponent.new(score: 1.0, max_score: 10))
  end

  def unknown
    render(QscoreQueryComponent.new(score: '?', max_score: 10))
  end

  def pending
    render(QscoreQueryComponent.new(score: '--', max_score: 10))
  end
end
