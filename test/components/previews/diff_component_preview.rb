# frozen_string_literal: true

# Preview for DiffComponent. View at /rails/view_components in development.
class DiffComponentPreview < ViewComponent::Preview
  def default
    render(DiffComponent.new(case_id: 1))
  end
end
