# frozen_string_literal: true

# Preview for DeleteCaseOptionsComponent. View at /rails/view_components in development.
class DeleteCaseOptionsComponentPreview < ViewComponent::Preview
  def default
    render(DeleteCaseOptionsComponent.new(case_id: 1, case_name: "Sample Case", try_number: 1, icon_only: true))
  end
end
