# frozen_string_literal: true

# Preview for JudgementsComponent. View at /rails/view_components in development.
class JudgementsComponentPreview < ViewComponent::Preview
  def with_teams
    render(JudgementsComponent.new(
      case_id: 1,
      case_name: "Sample Case",
      book_id: nil,
      book_name: nil,
      queries_count: 5,
      scorer_id: 1,
      teams: [{ id: 1, name: "Team A" }, { id: 2, name: "Team B" }]
    ))
  end

  def with_book_selected
    render(JudgementsComponent.new(
      case_id: 1,
      case_name: "Sample Case",
      book_id: 10,
      book_name: "My Book",
      queries_count: 3,
      scorer_id: 1,
      teams: [{ id: 1, name: "Team A" }]
    ))
  end
end
