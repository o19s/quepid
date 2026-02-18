# frozen_string_literal: true

# Preview for DeleteCaseComponent. View at /rails/view_components in development.
class DeleteCaseComponentPreview < ViewComponent::Preview
  def default
    render(DeleteCaseComponent.new(case_id: 1, case_name: "Sample Case"))
  end
end
