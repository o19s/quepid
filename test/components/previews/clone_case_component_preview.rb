# frozen_string_literal: true

# Preview for CloneCaseComponent. View at /rails/view_components in development.
class CloneCaseComponentPreview < ViewComponent::Preview
  def default
    render(
      CloneCaseComponent.new(
        case_id: 1,
        case_name: "Sample Case",
        tries: [
          { try_number: 1, name: "Try 1" },
          { try_number: 2, name: "Try 2" }
        ],
        last_try_number: 2
      )
    )
  end

  def single_try
    render(
      CloneCaseComponent.new(
        case_id: 1,
        case_name: "One Try",
        tries: [ { try_number: 1, name: "Try 1" } ],
        last_try_number: 1
      )
    )
  end
end
