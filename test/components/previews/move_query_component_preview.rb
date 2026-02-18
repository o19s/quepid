# frozen_string_literal: true

# Preview for MoveQueryComponent. View at /rails/view_components in development.
class MoveQueryComponentPreview < ViewComponent::Preview
  def with_other_cases
    render(MoveQueryComponent.new(
      query_id: 1,
      case_id: 1,
      other_cases: [
        { id: 2, case_name: "Other Case" },
        { id: 3, case_name: "Another Case" }
      ],
      try_number: 1
    ))
  end

  def no_other_cases
    render(MoveQueryComponent.new(query_id: 1, case_id: 1, other_cases: [], try_number: 1))
  end
end
