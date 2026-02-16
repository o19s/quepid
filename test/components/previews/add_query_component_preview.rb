# frozen_string_literal: true

# Preview for AddQueryComponent. View at /rails/view_components in development.
class AddQueryComponentPreview < ViewComponent::Preview
  def default
    render(AddQueryComponent.new(case_id: 1, can_add_queries: true))
  end

  def disabled
    render(AddQueryComponent.new(case_id: 1, can_add_queries: false))
  end
end
